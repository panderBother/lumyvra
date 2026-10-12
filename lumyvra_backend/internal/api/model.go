package api

import "time"

type User struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt"`
}

type Work struct {
	ID             string `json:"id"`
	OwnerID        string `json:"ownerId"`
	Artist         string `json:"artist"`
	Title          string `json:"title"`
	Description    string `json:"description"`
	Prompt         string `json:"prompt"`
	StylePrompt    string `json:"stylePrompt,omitempty"`
	Mode           string `json:"mode"`
	Genre          string `json:"genre"`
	Mood           string `json:"mood"`
	Seconds        int    `json:"seconds"`
	Cover          string `json:"cover"`
	Lyrics         string `json:"lyrics"`
	SourceID       string `json:"sourceId,omitempty"`
	SourceTitle    string `json:"sourceTitle,omitempty"`
	Status         string `json:"status"`
	Ready          bool   `json:"ready"`
	AllowRemix     bool   `json:"allowRemix"`
	GenerationMode string `json:"generationMode"`
	AudioURL       string `json:"audioUrl,omitempty"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
	PublishedAt    string `json:"publishedAt,omitempty"`
	Revision       int    `json:"revision"`
	CurrentVersion string `json:"currentVersionId,omitempty"`
}

type DraftInput struct {
	Prompt      string `json:"prompt"`
	StylePrompt string `json:"stylePrompt,omitempty"`
	Mode        string `json:"mode"`
	Genre       string `json:"genre"`
	Mood        string `json:"mood"`
	Seconds     int    `json:"seconds"`
	Cover       string `json:"cover"`
	SourceID    string `json:"sourceId,omitempty"`
	SourceTitle string `json:"sourceTitle,omitempty"`
	Regenerate  bool   `json:"regenerate,omitempty"`
	Revision    *int   `json:"revision,omitempty"`
}

type Job struct {
	ID             string      `json:"id"`
	WorkID         string      `json:"workId"`
	OwnerID        string      `json:"-"`
	Status         string      `json:"status"`
	Progress       int         `json:"progress"`
	Provider       string      `json:"provider"`
	Error          string      `json:"error,omitempty"`
	CreatedAt      string      `json:"createdAt"`
	UpdatedAt      string      `json:"updatedAt"`
	Stage          string      `json:"stage,omitempty"`
	ErrorCode      string      `json:"errorCode,omitempty"`
	Input          *DraftInput `json:"input,omitempty"`
	InputRevision  int         `json:"inputRevision,omitempty"`
	Submitted      bool        `json:"submitted,omitempty"`
	StartedAt      string      `json:"startedAt,omitempty"`
	IdempotencyKey string      `json:"idempotencyKey,omitempty"`
	VersionID      string      `json:"versionId,omitempty"`
}

type SongVersion struct {
	ID           string     `json:"id"`
	WorkID       string     `json:"workId"`
	OwnerID      string     `json:"-"`
	JobID        string     `json:"jobId"`
	Kind         string     `json:"kind"`
	Input        DraftInput `json:"input"`
	Lyrics       string     `json:"lyrics"`
	Caption      string     `json:"caption"`
	Model        string     `json:"model"`
	Seed         *int64     `json:"seed,omitempty"`
	Duration     float64    `json:"duration"`
	SampleRate   int        `json:"sampleRate"`
	Channels     int        `json:"channels"`
	Bytes        int64      `json:"bytes"`
	SHA256       string     `json:"sha256,omitempty"`
	AudioURL     string     `json:"audioUrl,omitempty"`
	CreatedAt    string     `json:"createdAt"`
	FileName     string     `json:"-"`
	ReviewStatus string     `json:"reviewStatus"`
}

func now() string { return time.Now().UTC().Format(time.RFC3339Nano) }

var genres = []string{"流行", "民谣", "电子", "R&B", "古风", "摇滚", "轻音乐", "说唱", "爵士", "纯音乐", "其他"}
var moods = []string{"开心", "治愈", "悲伤", "浪漫", "激情", "平静"}
var covers = []string{"community_sunset", "community_city", "community_stars", "sunset_coast", "community_island", "community_forest"}
