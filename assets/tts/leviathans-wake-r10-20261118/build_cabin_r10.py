"""Rebuild only the detached cabin with its rear doorway and furniture removed."""
from pathlib import Path
import ast, json, math, random, copy
import numpy as np
from cover_mesh import Mesh, uvbox
R=Path(__file__).resolve().parent
tree=ast.parse((R/'build_meshes.py').read_text())
definitions=ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[])
ns=dict(globals());exec(compile(definitions,str(R/'build_meshes.py'),'exec'),ns)
from scatter_r2 import install_scatter_builders
install_scatter_builders(ns)
stats=[]
for state,opened in [(1,True),(2,False)]:
    m,c=ns['hull'](7.2,5.2,3.5,'cabin',opened)
    name=f'detached-cabin-state-{state}'
    stats.extend([m.write(name),c.write(name+'-collider')])
(R/'cabin-build-r10.json').write_text(json.dumps(stats,indent=2)+'\n')
print('Rebuilt both cabin states: rear doorway, luggage bench and cabinet removed.')
