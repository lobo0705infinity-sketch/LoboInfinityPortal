"""Rebuild only the three reported Halcyon buildings; preserve other scenery."""
import build_halcyon as b
original_register=b.register
TARGETS={'intake-clinic','laundry-vault','recovery-lodge'}
def register(name,slug,*args,**kwargs):
 if slug in TARGETS:return original_register(name,slug,*args,**kwargs)
b.register=register
b.build()
