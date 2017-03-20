import React from 'react';
import BaseView from './BaseView';

class CameraView extends BaseView {

  /**
   * Use this lifeycle method to add event listeners
   */
  componentDidMount() {
    this.props.renderer.viewWillAppear();
  }

  componentWillUnmount() {
    this.props.renderer.viewWillDisappear();
  }

  render() {

    const domElement = this.props.renderer.render();

    return (
      <div
        id="camera-view"
        ref={(ref) => {
          if (ref) {
            domElement.className = 'three-canvas';
            ref.appendChild(domElement);
          }
        }}
      />
    );
  }

}

export default CameraView;
