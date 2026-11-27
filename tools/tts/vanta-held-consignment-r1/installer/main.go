package main

import (
	"archive/zip"
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const title = "Vanta Customs Yard - Held Consignment - B-Pong - Playtest"

var required = []string{"Play-Table.json", "Vanta-Customs-Yard.json", "Preview.png"}

func readPayload(path string) (map[string][]byte, error) {
	z, err := zip.OpenReader(path)
	if err != nil {
		return nil, err
	}
	defer z.Close()
	files := map[string][]byte{}
	for _, entry := range z.File {
		if entry.FileInfo().IsDir() {
			continue
		}
		if _, ok := files[entry.Name]; ok {
			return nil, fmt.Errorf("duplicate payload file %s", entry.Name)
		}
		if entry.UncompressedSize64 > 128<<20 {
			return nil, fmt.Errorf("oversized payload file")
		}
		r, err := entry.Open()
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(r)
		r.Close()
		if err != nil {
			return nil, err
		}
		files[entry.Name] = data
	}
	var manifest map[string]string
	if err := json.Unmarshal(files["manifest.json"], &manifest); err != nil {
		return nil, err
	}
	for _, name := range required {
		data, ok := files[name]
		if !ok {
			return nil, fmt.Errorf("missing %s", name)
		}
		sum := sha256.Sum256(data)
		if manifest[name] != hex.EncodeToString(sum[:]) {
			return nil, fmt.Errorf("checksum failed for %s", name)
		}
	}
	return files, nil
}

func writeNew(path string, data []byte) error {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return err
	}
	if _, err = f.Write(data); err == nil {
		err = f.Sync()
	}
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		os.Remove(path)
	}
	return err
}

func writeSave(saves string, data, preview []byte, created *[]string) error {
	for slot := 1; slot < 100000; slot++ {
		stem := filepath.Join(saves, fmt.Sprintf("TS_Save_%d", slot))
		if _, e := os.Lstat(stem + ".png"); !errors.Is(e, os.ErrNotExist) {
			if e != nil {
				return e
			}
			continue
		}
		if e := writeNew(stem+".json", data); e != nil {
			if errors.Is(e, os.ErrExist) {
				continue
			}
			return e
		}
		*created = append(*created, stem+".json")
		if e := writeNew(stem+".png", preview); e != nil {
			if errors.Is(e, os.ErrExist) {
				if e = os.Remove(stem + ".json"); e != nil {
					return e
				}
				*created = (*created)[:len(*created)-1]
				continue
			}
			return e
		}
		*created = append(*created, stem+".png")
		return nil
	}
	return fmt.Errorf("no save slot available")
}

func install(root, payload string) (created []string, err error) {
	files, err := readPayload(payload)
	if err != nil {
		return nil, err
	}
	if strings.EqualFold(filepath.Base(filepath.Clean(root)), "Saves") {
		root = filepath.Dir(filepath.Clean(root))
	}
	saves := filepath.Join(root, "Saves")
	if err = os.MkdirAll(saves, 0755); err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			for i := len(created) - 1; i >= 0; i-- {
				os.Remove(created[i])
			}
		}
	}()
	if err = writeSave(saves, files["Play-Table.json"], files["Preview.png"], &created); err != nil {
		return created, err
	}
	objects := filepath.Join(saves, "Saved Objects")
	if err = os.MkdirAll(objects, 0755); err != nil {
		return created, err
	}
	folder, err := os.MkdirTemp(objects, "Lobo-Vanta-Held-Consignment-")
	if err != nil {
		return created, err
	}
	created = append(created, folder)
	for _, pair := range [][2]string{{"Vanta-Customs-Yard.json", "Vanta-Customs-Yard.json"}, {"Vanta-Customs-Yard.png", "Preview.png"}} {
		dest := filepath.Join(folder, pair[0])
		if err = writeNew(dest, files[pair[1]]); err != nil {
			return created, err
		}
		created = append(created, dest)
	}
	return created, nil
}

func main() {
	root := flag.String("tts-root", "", "Tabletop Simulator data folder or Saves folder")
	payload := flag.String("payload", "", "Path to the release payload")
	noPause := flag.Bool("no-pause", false, "Exit immediately")
	flag.Parse()
	if *root == "" && flag.NArg() > 0 {
		*root = flag.Arg(0)
	}
	var err error
	if *root == "" {
		*root, err = defaultRoot()
	}
	if err == nil && *payload == "" {
		var exe string
		if exe, err = os.Executable(); err == nil {
			*payload = filepath.Join(filepath.Dir(exe), "Files", "payload.zip")
		}
	}
	if err == nil {
		var paths []string
		paths, err = install(*root, *payload)
		if err == nil {
			fmt.Println("Installed", title)
			fmt.Println("Ready-to-play table:", paths[0])
			fmt.Println("Saved Stage bag:", paths[3])
			fmt.Println("Open Games > Save & Load in Tabletop Simulator.")
		}
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "Installation failed:", err)
	}
	if !*noPause {
		fmt.Print("Press Enter to close. ")
		bufio.NewReader(os.Stdin).ReadString('\n')
	}
	if err != nil {
		os.Exit(1)
	}
}
