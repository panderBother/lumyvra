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
}

type DraftInput struct {
	Prompt      string `json:"prompt"`
	Mode        string `json:"mode"`
	Genre       string `json:"genre"`
	Mood        string `json:"mood"`
	Seconds     int    `json:"seconds"`
	Cover       string `json:"cover"`
	SourceID    string `json:"sourceId,omitempty"`
	SourceTitle string `json:"sourceTitle,omitempty"`
	Regenerate  bool   `json:"regenerate,omitempty"`
}

type Job struct {
	ID        string `json:"id"`
	WorkID    string `json:"workId"`
	OwnerID   string `json:"-"`
	Status    string `json:"status"`
	Progress  int    `json:"progress"`
	Provider  string `json:"provider"`
	Error     string `json:"error,omitempty"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

func now() string { return time.Now().UTC().Format(time.RFC3339Nano) }

var genres = []string{"流行", "民谣", "电子", "R&B", "古风", "摇滚", "轻音乐", "说唱", "爵士", "纯音乐", "其他"}
var moods = []string{"开心", "治愈", "悲伤", "浪漫", "激情", "平静"}
var covers = []string{"community_sunset", "community_city", "community_stars", "sunset_coast", "community_island", "community_forest"}
