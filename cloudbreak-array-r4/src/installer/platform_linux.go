package main

import (
	"errors"
	"os"
	"path/filepath"
)

func defaultRoot() (string, error) {
	h, e := os.UserHomeDir()
	if e != nil {
		return "", e
	}
	return filepath.Join(h, "Documents", "My Games", "Tabletop Simulator"), nil
}
func openWorkshop() error { return errors.New("browser launch disabled on test host") }
