package main

import (
	"archive/zip"
	"bufio"
	"bytes"
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
	"time"
)

const collectionName = "Lobo Maps - Standard Controls R2"
const workshopURL = "https://steamcommunity.com/sharedfiles/filedetails/?id=3719263238"

type object = map[string]any
type patch struct {
	Map  string `json:"map"`
	GUID string `json:"guid"`
	Old  string `json:"old"`
	New  string `json:"new"`
}
type receipt struct {
	Version string `json:"version"`
	Source  string `json:"source"`
	Save    string `json:"collection_save"`
	Maps    int    `json:"maps"`
	Changed int    `json:"scripts_updated"`
	Note    string `json:"note,omitempty"`
}

func str(o object, k string) string { s, _ := o[k].(string); return s }
func arr(o object, k string) []any  { a, _ := o[k].([]any); return a }
func decode(b []byte) (object, error) {
	var d object
	dec := json.NewDecoder(bytes.NewReader(bytes.TrimPrefix(b, []byte{0xef, 0xbb, 0xbf})))
	dec.UseNumber()
	e := dec.Decode(&d)
	if e != nil {
		return nil, e
	}
	var extra any
	if dec.Decode(&extra) != io.EOF {
		return nil, errors.New("trailing JSON")
	}
	return d, nil
}
func encode(o any) ([]byte, error) {
	var b bytes.Buffer
	e := json.NewEncoder(&b)
	e.SetEscapeHTML(false)
	err := e.Encode(o)
	return b.Bytes(), err
}
func walk(o object, f func(object)) {
	f(o)
	for _, k := range []string{"ContainedObjects", "ChildObjects"} {
		for _, v := range arr(o, k) {
			if c, ok := v.(map[string]any); ok {
				walk(c, f)
			}
		}
	}
	if states, ok := o["States"].(map[string]any); ok {
		for _, v := range states {
			if c, ok := v.(map[string]any); ok {
				walk(c, f)
			}
		}
	}
}
func maps(d object) []object {
	var found []object
	var visit func(object)
	visit = func(o object) {
		if str(o, "Name") == "Bag" && strings.HasPrefix(str(o, "Nickname"), "SET_") && strings.Contains(str(o, "LuaScript"), "--") {
			found = append(found, o)
			return
		}
		for _, v := range arr(o, "ContainedObjects") {
			if c, ok := v.(map[string]any); ok {
				visit(c)
			}
		}
	}
	for _, v := range arr(d, "ObjectStates") {
		if o, ok := v.(map[string]any); ok {
			visit(o)
		}
	}
	return found
}
func supported(d object) bool {
	stage := false
	for _, v := range arr(d, "ObjectStates") {
		if o, ok := v.(map[string]any); ok && str(o, "GUID") == "2d647a" {
			stage = true
		}
	}
	return stage && len(maps(d)) >= 100
}
func payload(path string) (map[string][]byte, error) {
	z, e := zip.OpenReader(path)
	if e != nil {
		return nil, fmt.Errorf("extract the whole ZIP first: %w", e)
	}
	defer z.Close()
	files := map[string][]byte{}
	for _, f := range z.File {
		if f.FileInfo().IsDir() {
			continue
		}
		if f.UncompressedSize64 > 250000000 {
			return nil, errors.New("oversized payload")
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
		if _, ok := files[f.Name]; ok {
			return nil, errors.New("duplicate payload entry")
		}
		files[f.Name] = b
	}
	var m struct {
		Files []struct {
			Name string `json:"name"`
			SHA  string `json:"sha256"`
		} `json:"files"`
	}
	if e = json.Unmarshal(files["installer-manifest.json"], &m); e != nil {
		return nil, e
	}
	checked := map[string]bool{}
	for _, f := range m.Files {
		b, ok := files[f.Name]
		if !ok {
			return nil, fmt.Errorf("missing %s", f.Name)
		}
		s := sha256.Sum256(b)
		if hex.EncodeToString(s[:]) != f.SHA {
			return nil, fmt.Errorf("checksum failed: %s", f.Name)
		}
		checked[f.Name] = true
	}
	for _, n := range []string{"Workshop-Save.json", "Workshop-Save.png", "control-patches.json"} {
		if !checked[n] {
			return nil, fmt.Errorf("unverified payload: %s", n)
		}
	}
	return files, nil
}
func apply(d object, ps []patch) (int, error) {
	if !supported(d) {
		return 0, errors.New("not a complete Lobo collection")
	}
	byMap := map[string][]patch{}
	for _, p := range ps {
		byMap[p.Map] = append(byMap[p.Map], p)
	}
	seen := map[string]bool{}
	changed := 0
	for _, b := range maps(d) {
		want, ok := byMap[str(b, "GUID")]
		if !ok {
			return 0, fmt.Errorf("unrecognized map version: %s", str(b, "Nickname"))
		}
		seen[str(b, "GUID")] = true
		nodes := map[string]object{}
		walk(b, func(o object) { nodes[str(o, "GUID")] = o })
		for _, p := range want {
			o, ok := nodes[p.GUID]
			if !ok {
				return 0, fmt.Errorf("changed object IDs in %s", str(b, "Nickname"))
			}
			s := str(o, "LuaScript")
			if s == p.New {
				continue
			}
			if s != p.Old {
				return 0, fmt.Errorf("newer or different controls in %s (%s)", str(b, "Nickname"), p.GUID)
			}
			o["LuaScript"] = p.New
			changed++
		}
	}
	if len(seen) != 105 {
		return 0, fmt.Errorf("source has %d of the 105 supported setups", len(seen))
	}
	d["SaveName"] = collectionName
	return changed, nil
}
func selectSave(root, explicit string, files map[string][]byte, ps []patch) (object, string, int, string, error) {
	source := "Included audited collection"
	b := files["Workshop-Save.json"]
	if explicit != "" {
		var e error
		b, e = os.ReadFile(explicit)
		if e != nil {
			return nil, "", 0, "", e
		}
		source = explicit
	}
	d, e := decode(b)
	if e != nil {
		return nil, "", 0, "", e
	}
	n, e := apply(d, ps)
	return d, source, n, "", e
}
func writeNew(path string, b []byte) error {
	f, e := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
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
		os.Remove(path)
	}
	return e
}
func install(root, explicit, path string) (out receipt, err error) {
	files, e := payload(path)
	if e != nil {
		return out, e
	}
	var ps []patch
	if e = json.Unmarshal(files["control-patches.json"], &ps); e != nil {
		return out, e
	}
	d, source, n, note, e := selectSave(root, explicit, files, ps)
	if e != nil {
		return out, e
	}
	b, e := encode(d)
	if e != nil {
		return out, e
	}
	saveDir := filepath.Join(root, "Saves")
	if e = os.MkdirAll(saveDir, 0755); e != nil {
		return out, e
	}
	var created []string
	defer func() {
		if err != nil {
			for _, p := range created {
				os.Remove(p)
			}
		}
	}()
	for i := 1; i < 100000; i++ {
		base := filepath.Join(saveDir, fmt.Sprintf("TS_Save_%d", i))
		if _, e = os.Lstat(base + ".png"); e == nil {
			continue
		} else if !errors.Is(e, os.ErrNotExist) {
			return out, e
		}
		e = writeNew(base+".json", b)
		if errors.Is(e, os.ErrExist) {
			continue
		}
		if e != nil {
			return out, e
		}
		created = append(created, base+".json")
		if e = writeNew(base+".png", files["Workshop-Save.png"]); e != nil {
			return out, e
		}
		created = append(created, base+".png")
		out.Save = base + ".json"
		break
	}
	if out.Save == "" {
		return out, errors.New("no unused save slot")
	}
	out.Version = "Standard Controls R2"
	out.Source = source
	out.Maps = len(maps(d))
	out.Changed = n
	out.Note = note
	logDir := filepath.Join(root, "Lobo Install Logs")
	if e = os.MkdirAll(logDir, 0755); e != nil {
		return out, e
	}
	log, e := encode(out)
	if e != nil {
		return out, e
	}
	lp := filepath.Join(logDir, "Standard-Controls-R2-"+time.Now().UTC().Format("20060102T150405.000000000")+".json")
	if e = writeNew(lp, log); e != nil {
		return out, e
	}
	created = append(created, lp)
	return out, nil
}
func main() {
	root := flag.String("tts-root", "", "TTS data folder")
	source := flag.String("source-save", "", "Explicit complete collection")
	path := flag.String("payload", "", "Payload ZIP")
	noBrowser := flag.Bool("no-browser", false, "Do not open Workshop")
	noPause := flag.Bool("no-pause", false, "Exit immediately")
	flag.Parse()
	code := 0
	defer func() {
		if !*noPause {
			fmt.Print("\nPress Enter to close...")
			bufio.NewReader(os.Stdin).ReadString('\n')
		}
		os.Exit(code)
	}()
	fmt.Println("LOBO STANDARD MAP CONTROLS - WORKSHOP SETUP R2")
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
	if strings.EqualFold(filepath.Base(*root), "Saves") {
		*root = filepath.Dir(*root)
	}
	if *path == "" {
		exe, e := os.Executable()
		if e != nil {
			fmt.Println(e)
			code = 1
			return
		}
		*path = filepath.Join(filepath.Dir(exe), "Files", "payload.zip")
	}
	out, e := install(*root, *source, *path)
	if e != nil {
		fmt.Println("INSTALLATION FAILED:", e)
		fmt.Println("Existing saves were preserved.")
		code = 1
		return
	}
	fmt.Println("Installed:", collectionName)
	fmt.Println("Map setups:", out.Maps)
	fmt.Println("Source:", out.Source)
	if out.Note != "" {
		fmt.Println(out.Note)
	}
	fmt.Println("In TTS: Games > Save & Load >", collectionName)
	fmt.Println("Map Controls: Turn 180, independent zone colors, guides and background. All 105 setups use the same panel.")
	fmt.Println("Publish: Upload > Workshop Upload > Update Workshop > 3719263238")
	fmt.Println("Steam publication is completed inside TTS. Existing saves remain intact.")
	if !*noBrowser {
		if e = openWorkshop(); e != nil {
			fmt.Println("Workshop:", workshopURL)
		}
	}
}
