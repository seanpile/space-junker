
import * as THREE from 'three';

class UIApsis extends THREE.Group {

  static createApsis(text, fonts) {

    const textGeometry = new THREE.TextGeometry(
          text,
          { font: fonts.helvetiker, size: 1, height: 0 });
    textGeometry.computeBoundingBox();
    const textSize = textGeometry.boundingBox.getSize();

    const padding = 0.25;
    const boxshape = new THREE.Shape();
    boxshape.moveTo(-padding, -padding);
    boxshape.lineTo(-padding, textSize.y + padding);
    boxshape.lineTo(padding + textSize.x, textSize.y + padding);
    boxshape.lineTo(padding + textSize.x, -padding);
    boxshape.lineTo(textSize.x / 2, -((textSize.y / 2) + padding));
    boxshape.lineTo(-padding, -padding);

    const textObject = new THREE.Mesh(
          textGeometry,
          new THREE.MeshBasicMaterial(
            { depthFunc: THREE.AlwaysDepth },
          ));

    const boxObject = new THREE.Mesh(
          new THREE.ShapeBufferGeometry(boxshape),
          new THREE.MeshBasicMaterial({
            color: 'aqua',
            transparent: true,
            opacity: 0.5,
            depthFunc: THREE.AlwaysDepth,
          }),
        );

    textObject.translateY((textSize.y / 2) + padding);
    boxObject.translateY((textSize.y / 2) + padding);
    textObject.translateX(-textSize.x / 2);
    boxObject.translateX(-textSize.x / 2);

    const apsis = new UIApsis();
    apsis.add(boxObject);
    apsis.add(textObject);

    return apsis;
  }

}

export default UIApsis;
