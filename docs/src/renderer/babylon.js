// FILE: docs/src/renderer/babylon.js
function mkMat(scene, name, color, alpha = 1) {
  const m = new BABYLON.StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.alpha = alpha;
  return m;
}

export function boot(canvas) {
  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.96, 0.97, 0.98, 1);

  const camera = new BABYLON.ArcRotateCamera(
    'cam',
    -Math.PI / 4,
    Math.PI / 3,
    8,
    new BABYLON.Vector3(1.5, 0, 2),
    scene
  );

  if (camera.wheelDeltaPercentage !== undefined) {
    camera.wheelDeltaPercentage = 0.01;
    camera.pinchDeltaPercentage = 0.01;
  } else {
    camera.wheelPrecision = Math.max(100, camera.wheelPrecision || 50);
    camera.pinchPrecision = Math.max(100, camera.pinchPrecision || 50);
  }
  camera.inertia = 0.85;
  camera.lowerRadiusLimit = 0.5;
  camera.upperRadiusLimit = 200;

  camera.attachControl(canvas, true);

  new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);

  const materials = {
    timber: mkMat(scene, 'timber', new BABYLON.Color3(0.55, 0.43, 0.33)),
    plate:  mkMat(scene, 'plate',  new BABYLON.Color3(0.45, 0.35, 0.27)),
    base:   mkMat(scene, 'base',   new BABYLON.Color3(0.2, 0.2, 0.2)),
    guide:  mkMat(scene, 'guide',  new BABYLON.Color3(0.25, 0.25, 0.25), 0.9),
  };

  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());

  return { engine, scene, camera, materials };
}

export function disposeAll(scene) {
  scene.meshes
    .filter(m => m && m.metadata && m.metadata.dynamic === true)
    .forEach(m => { if (!m.isDisposed()) m.dispose(false, true); });
}
