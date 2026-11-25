package main

import (
	"archive/zip"
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const workshopURL = "https://steamcommunity.com/sharedfiles/filedetails/?id=3719263238"
const release = "R4.1"

func writeNew(p string, b []byte) error {
	f, e := os.OpenFile(p, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if e != nil {
		return e
	}
	_, e = f.Write(b)
	if e == nil {
		e = f.Sync()
	}
	ce := f.Close()
	if e == nil {
		e = ce
	}
	if e != nil {
		os.Remove(p)
	}
	return e
}
func loadPayload(path string) (map[string][]byte, error) {
	z, e := zip.OpenReader(path)
	if e != nil {
		return nil, e
	}
	defer z.Close()
	files := map[string][]byte{}
	for _, f := range z.File {
		if f.FileInfo().IsDir() {
			continue
		}
		if f.UncompressedSize64 > 250000000 {
			return nil, fmt.Errorf("oversized payload")
		}
		if _, ok := files[f.Name]; ok {
			return nil, fmt.Errorf("duplicate payload entry")
		}
		r, e := f.Open()
		if e != nil {
			return nil, e
		}
		b, e := io.ReadAll(r)
		r.Close()
		if e != nil {
			return nil, e
		}
		files[f.Name] = b
	}
	var m map[string]string
	if e = json.Unmarshal(files["manifest.json"], &m); e != nil {
		return nil, e
	}
	for _, n := range []string{"Workshop-Save.json", "Play-Table.json", "Cloudbreak-Array.json", "Preview.png"} {
		b, ok := files[n]
		if !ok {
			return nil, fmt.Errorf("missing %s", n)
		}
		h := sha256.Sum256(b)
		if hex.EncodeToString(h[:]) != m[n] {
			return nil, fmt.Errorf("checksum failed: %s", n)
		}
	}
	return files, nil
}
func install(root, path string) (created []string, err error) {
	files, e := loadPayload(path)
	if e != nil {
		return nil, e
	}
	defer func() {
		if err != nil {
			for _, p := range created {
				os.Remove(p)
			}
		}
	}()
	if strings.EqualFold(filepath.Base(filepath.Clean(root)), "Saves") {
		root = filepath.Dir(filepath.Clean(root))
	}
	saves := filepath.Join(root, "Saves")
	if e = os.MkdirAll(saves, 0755); e != nil {
		return nil, e
	}
	for _, name := range []string{"Play-Table.json", "Workshop-Save.json"} {
		done := false
		for i := 1; i < 100000; i++ {
			p := filepath.Join(saves, fmt.Sprintf("TS_Save_%d", i))
			if _, e = os.Lstat(p + ".json"); !os.IsNotExist(e) {
				continue
			}
			if _, e = os.Lstat(p + ".png"); !os.IsNotExist(e) {
				continue
			}
			if e = writeNew(p+".json", files[name]); os.IsExist(e) {
				continue
			} else if e != nil {
				return created, e
			}
			created = append(created, p+".json")
			if e = writeNew(p+".png", files["Preview.png"]); e != nil {
				return created, e
			}
			created = append(created, p+".png")
			done = true
			break
		}
		if !done {
			return created, fmt.Errorf("no free save slot")
		}
	}
	objects := filepath.Join(root, "Saves", "Saved Objects")
	if e = os.MkdirAll(objects, 0755); e != nil {
		return created, e
	}
	dir, e := os.MkdirTemp(objects, "Lobo-Cloudbreak-Array-"+release+"-")
	if e != nil {
		return created, e
	}
	for _, name := range []string{"Cloudbreak-Array.json"} {
		p := filepath.Join(dir, name)
		if e = writeNew(p, files[name]); e != nil {
			return created, e
		}
		created = append(created, p)
		thumb := p[:len(p)-5] + ".png"
		if e = writeNew(thumb, files["Preview.png"]); e != nil {
			return created, e
		}
		created = append(created, thumb)
	}
	return created, nil
}
func main() {
	root := flag.String("tts-root", "", "Tabletop Simulator data folder")
	payload := flag.String("payload", "", "Payload ZIP")
	noBrowser := flag.Bool("no-browser", false, "Do not open Workshop page")
	noPause := flag.Bool("no-pause", false, "Exit immediately")
	flag.Parse()
	code := 0
	defer func() {
		if !*noPause {
			fmt.Print("Press Enter to close...")
			bufio.NewReader(os.Stdin).ReadString('\n')
		}
		os.Exit(code)
	}()
	if *root == "" && flag.NArg() > 0 {
		*root = flag.Arg(0)
	}
	if *root == "" {
		r, e := defaultRoot()
		if e != nil {
			fmt.Println(e)
			code = 1
			return
		}
		*root = r
	}
	if *payload == "" {
		exe, _ := os.Executable()
		*payload = filepath.Join(filepath.Dir(exe), "Files", "payload.zip")
	}
	paths, e := install(*root, *payload)
	if e != nil {
		fmt.Println("Installation failed:", e)
		fmt.Println("Existing saves were preserved.")
		code = 1
		return
	}
	fmt.Println("CLOUDBREAK ARRAY " + release + " INSTALLED")
	for _, p := range paths {
		fmt.Println(p)
	}
	fmt.Println("TTS > Games > Save & Load > Cloudbreak Array " + release + " - Network Node")
	fmt.Println("The separate Lobo Maps - Cloudbreak Array Workshop " + release + " save keeps the full collection.")
	fmt.Println("Load the collection save to use Update Workshop.")
	if !*noBrowser {
		if e = openWorkshop(); e != nil {
			fmt.Println(workshopURL)
		}
	}
}
