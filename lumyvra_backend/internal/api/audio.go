package api

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const maxAudioBytes = 160 << 20

func readWave(file *os.File) (duration float64, sampleRate, channels int, err error) {
	info, err := file.Stat()
	if err != nil {
		return 0, 0, 0, err
	}
	var header [12]byte
	if _, err = file.ReadAt(header[:], 0); err != nil || string(header[:4]) != "RIFF" || string(header[8:]) != "WAVE" {
		return 0, 0, 0, errors.New("invalid WAV header")
	}
	var bytesPerFrame int
	var dataSize int64
	for offset := int64(12); offset+8 <= info.Size(); {
		var chunk [8]byte
		if _, err = file.ReadAt(chunk[:], offset); err != nil {
			return 0, 0, 0, err
		}
		size := int64(binary.LittleEndian.Uint32(chunk[4:]))
		if offset+8+size > info.Size() {
			return 0, 0, 0, errors.New("truncated WAV")
		}
		if string(chunk[:4]) == "fmt " {
			if size < 16 || size > 1024 {
				return 0, 0, 0, errors.New("invalid WAV format")
			}
			format := make([]byte, size)
			if _, err = file.ReadAt(format, offset+8); err != nil {
				return 0, 0, 0, err
			}
			encoding := binary.LittleEndian.Uint16(format[:2])
			if encoding == 65534 && size >= 40 {
				encoding = binary.LittleEndian.Uint16(format[24:26])
			}
			channels = int(binary.LittleEndian.Uint16(format[2:4]))
			sampleRate = int(binary.LittleEndian.Uint32(format[4:8]))
			bits := int(binary.LittleEndian.Uint16(format[14:16]))
			bytesPerFrame = int(binary.LittleEndian.Uint16(format[12:14]))
			if (encoding != 1 && encoding != 3) || (bits != 16 && bits != 24 && bits != 32) || (encoding == 3 && bits != 32) || channels < 1 || channels > 2 || sampleRate < 16000 || sampleRate > 192000 || bytesPerFrame != channels*bits/8 {
				return 0, 0, 0, errors.New("unsupported WAV format")
			}
		} else if string(chunk[:4]) == "data" {
			dataSize += size
		}
		offset += 8 + size + (size % 2)
	}
	if bytesPerFrame <= 0 || dataSize <= 0 || dataSize%int64(bytesPerFrame) != 0 {
		return 0, 0, 0, errors.New("empty WAV")
	}
	return float64(dataSize) / float64(bytesPerFrame) / float64(sampleRate), sampleRate, channels, nil
}

func (s *Server) storeInferenceAudio(ctx context.Context, id string, remote inferenceResult, version *SongVersion) error {
	metadata := remote.Result.Audio
	if len(metadata.SHA256) != 64 || metadata.Bytes <= 44 || metadata.Bytes > maxAudioBytes || math.IsNaN(metadata.Duration) || math.IsInf(metadata.Duration, 0) {
		return errors.New("invalid audio metadata")
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	r, err := http.NewRequestWithContext(ctx, "GET", strings.TrimRight(s.cfg.InferenceURL, "/")+"/v1/jobs/"+id+"/audio", nil)
	if err != nil {
		return err
	}
	r.Header.Set("Authorization", "Bearer "+s.cfg.InferenceKey)
	client := &http.Client{Timeout: 2 * time.Minute, CheckRedirect: s.inferenceHTTP.CheckRedirect}
	response, err := client.Do(r)
	if err != nil {
		return errors.New("audio transfer failed")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return errors.New("audio unavailable")
	}
	root, err := filepath.Abs(s.cfg.MediaDir)
	if err != nil {
		return err
	}
	if err = os.MkdirAll(root, 0700); err != nil {
		return err
	}
	file, err := os.CreateTemp(root, ".incoming-*.wav")
	if err != nil {
		return err
	}
	defer file.Close()
	digest := sha256.New()
	written, err := io.Copy(io.MultiWriter(file, digest), io.LimitReader(response.Body, maxAudioBytes+1))
	if err != nil || written != metadata.Bytes || written > maxAudioBytes || hex.EncodeToString(digest.Sum(nil)) != metadata.SHA256 {
		return errors.New("audio integrity failed")
	}
	duration, sampleRate, channels, err := readWave(file)
	if err != nil || math.Abs(duration-metadata.Duration) > 0.05 || duration < float64(version.Input.Seconds)*0.75 || duration > float64(version.Input.Seconds)*1.25 || sampleRate != metadata.SampleRate || channels != metadata.Channels {
		return errors.New("audio validation failed")
	}
	if err = file.Sync(); err != nil {
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	version.FileName = version.ID + ".wav"
	final := filepath.Join(root, version.FileName)
	// A previous interrupted registration may have left the same immutable asset.
	if existing, e := os.Open(final); e == nil {
		hash := sha256.New()
		_, e = io.Copy(hash, existing)
		existing.Close()
		if e != nil || hex.EncodeToString(hash.Sum(nil)) != metadata.SHA256 {
			return errors.New("immutable asset conflict")
		}
	} else if !os.IsNotExist(e) {
		return e
	} else if err = os.Rename(file.Name(), final); err != nil {
		return err
	}
	// Failed transfers remain quarantined; no automatic deletion of large files.
	version.Duration, version.SampleRate, version.Channels, version.Bytes, version.SHA256 = duration, sampleRate, channels, written, metadata.SHA256
	version.AudioURL = "/api/audio/" + version.ID
	return nil
}

func getVersion(q querier, id string) (SongVersion, error) {
	var version SongVersion
	var raw, owner, fileName string
	err := q.QueryRow("SELECT data,owner_id,file_name FROM song_versions WHERE id=?", id).Scan(&raw, &owner, &fileName)
	if err == nil {
		err = json.Unmarshal([]byte(raw), &version)
		version.OwnerID, version.FileName = owner, fileName
	}
	return version, err
}
func applyVersion(work *Work, version SongVersion) {
	work.CurrentVersion, work.AudioURL, work.Lyrics, work.Ready, work.GenerationMode, work.UpdatedAt = version.ID, version.AudioURL, version.Lyrics, true, "live", now()
}

func (s *Server) listVersions(w http.ResponseWriter, r *http.Request) {
	work, ok := s.owner(w, r)
	if !ok {
		return
	}
	rows, err := s.db.Query("SELECT data FROM song_versions WHERE work_id=? ORDER BY rowid DESC", work.ID)
	if err != nil {
		internal(w, err)
		return
	}
	defer rows.Close()
	versions := []SongVersion{}
	for rows.Next() {
		var raw string
		var version SongVersion
		if err = rows.Scan(&raw); err == nil {
			err = json.Unmarshal([]byte(raw), &version)
		}
		if err != nil {
			internal(w, err)
			return
		}
		versions = append(versions, version)
	}
	if err = rows.Err(); err != nil {
		internal(w, err)
		return
	}
	jsonResponse(w, 200, map[string]any{"versions": versions, "currentVersionId": work.CurrentVersion})
}
func (s *Server) adoptVersion(w http.ResponseWriter, r *http.Request) {
	s.mutations.Lock()
	defer s.mutations.Unlock()
	work, ok := s.owner(w, r)
	if !ok {
		return
	}
	if work.Status != "draft" {
		fail(w, 409, "published", "已发布音频保持固定，请在新草稿中继续创作。")
		return
	}
	version, err := getVersion(s.db, r.PathValue("version"))
	if err != nil || version.WorkID != work.ID || version.OwnerID != work.OwnerID {
		fail(w, 404, "not_found", "候选版本不存在。")
		return
	}
	if version.Kind == "audio" {
		info, e := os.Stat(filepath.Join(s.cfg.MediaDir, version.FileName))
		if e != nil || info.Size() != version.Bytes {
			fail(w, 409, "asset_missing", "版本音频缺失或损坏，请恢复文件后重试。")
			return
		}
	}
	applyVersion(&work, version)
	if err = saveWork(s.db, work); err != nil {
		internal(w, err)
		return
	}
	jsonResponse(w, 200, map[string]any{"work": work})
}
func (s *Server) serveAudio(w http.ResponseWriter, r *http.Request) {
	version, err := getVersion(s.db, r.PathValue("id"))
	if err != nil || version.Kind != "audio" {
		fail(w, 404, "not_found", "音频不存在。")
		return
	}
	work, err := getWork(s.db, version.WorkID)
	if err != nil {
		fail(w, 404, "not_found", "音频不存在。")
		return
	}
	owner := currentUser(r) != nil && currentUser(r).ID == version.OwnerID
	if !owner && (work.Status != "published" || work.CurrentVersion != version.ID) {
		fail(w, 404, "not_found", "音频不存在或未公开。")
		return
	}
	if filepath.Base(version.FileName) != version.FileName {
		fail(w, 404, "not_found", "音频不存在。")
		return
	}
	file, err := os.Open(filepath.Join(s.cfg.MediaDir, version.FileName))
	if err != nil {
		fail(w, 404, "asset_missing", "音频文件缺失。")
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || info.Size() != version.Bytes {
		fail(w, 409, "output_invalid", "音频文件损坏。")
		return
	}
	w.Header().Set("Content-Type", "audio/wav")
	if r.URL.Query().Get("download") == "1" {
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", version.ID+".wav"))
	}
	http.ServeContent(w, r, version.ID+".wav", info.ModTime(), file)
}
