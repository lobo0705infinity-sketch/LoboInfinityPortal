"""Decode OBJ assets using the same X-axis convention as TTS's importer."""
import trimesh
def load_tts_mesh(path):
 m=trimesh.load(path,force='mesh',process=False)
 m.vertices[:,0]*=-1
 m.faces=m.faces[:,::-1]
 return m
