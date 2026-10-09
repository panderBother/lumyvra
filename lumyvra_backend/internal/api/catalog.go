package api

import (
	_ "embed"
	"encoding/json"
)

//go:embed catalog.json
var catalogJSON []byte
var catalog []Work

func init() {
	if err := json.Unmarshal(catalogJSON, &catalog); err != nil {
		panic(err)
	}
}
