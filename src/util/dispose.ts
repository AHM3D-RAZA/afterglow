import {
  DirectionalLight,
  Line,
  Mesh,
  Points,
  PointLight,
  SpotLight,
  Texture,
  type Material,
  type Object3D,
} from 'three';

/**
 * Releases the GPU resources owned by everything under `root`:
 * geometries, materials, any textures those materials reference, and
 * light shadow maps. Safe to call on shared materials more than once.
 */
export function disposeObject3D(root: Object3D): void {
  root.traverse((object) => {
    if (object instanceof Mesh || object instanceof Line || object instanceof Points) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(disposeMaterial);
    } else if (
      object instanceof SpotLight ||
      object instanceof PointLight ||
      object instanceof DirectionalLight
    ) {
      object.dispose();
    }
  });
}

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) value.dispose();
  }
  material.dispose();
}
