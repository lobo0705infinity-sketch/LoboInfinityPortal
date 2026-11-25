package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type releaseObject struct {
	Name      string
	File      string
	Thumbnail string
}
type releaseSelection struct {
	Name          string
	PlayFile      string
	PlayThumbnail string
	Objects       []releaseObject
}
type releaseExtras struct {
	Standalone []releaseObject
	Setups     map[string]releaseSelection
}

// Each optional saved object gets its own collision-safe JSON/thumbnail pair.
func installObject(dir string, entry releaseObject, files map[string][]byte, created *[]string) error {
	if entry.Name == "" || filepath.Base(entry.Name) != entry.Name {
		return fmt.Errorf("invalid saved-object name")
	}
	data, exists := files[entry.File]
	if !exists {
		return fmt.Errorf("missing saved object %s", entry.Name)
	}
	thumb := files[entry.Thumbnail]
	if entry.Thumbnail != "" && len(thumb) == 0 {
		return fmt.Errorf("missing thumbnail for %s", entry.Name)
	}
	for i := 1; i < 100000; i++ {
		name := entry.Name
		if i > 1 {
			name = fmt.Sprintf("%s (%d)", name, i)
		}
		target := filepath.Join(dir, name)
		existing, err := os.ReadFile(target + ".json")
		if err == nil {
			if bytes.Equal(existing, data) {
				if len(thumb) == 0 {
					return nil
				}
				pic, readErr := os.ReadFile(target + ".png")
				if readErr == nil && bytes.Equal(pic, thumb) {
					return nil
				}
			}
			continue
		}
		if !os.IsNotExist(err) {
			return err
		}
		if _, err = os.Lstat(target + ".png"); err == nil {
			continue
		} else if !os.IsNotExist(err) {
			return err
		}
		if err = writeNew(target+".json", data); os.IsExist(err) {
			continue
		} else if err != nil {
			return err
		}
		*created = append(*created, target+".json")
		if len(thumb) > 0 {
			if err = writeNew(target+".png", thumb); err != nil {
				return err
			}
			*created = append(*created, target+".png")
		}
		return nil
	}
	return fmt.Errorf("no unused name for %s", entry.Name)
}

func readExtras(files map[string][]byte) (releaseExtras, error) {
	var extras releaseExtras
	err := json.Unmarshal(files["release-extras.json"], &extras)
	return extras, err
}
