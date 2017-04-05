
import * as THREE from 'three';

class Apsis extends THREE.Group {

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

    const boxGeometry = new THREE.ShapeBufferGeometry(boxshape);
    boxGeometry.computeBoundingBox();
    const boxSize = boxGeometry.boundingBox.getSize();
    textObject.translateY(boxSize.y / 2);
    textObject.translateX(-boxSize.x / 2);
    boxObject.translateY(boxSize.y / 2);
    boxObject.translateX(-boxSize.x / 2);

    const apsis = new Apsis();
    apsis.add(boxObject);
    apsis.add(textObject);

    return apsis;
  }

}

export default Apsis;
