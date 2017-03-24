import React from 'react';

class CameraView extends React.Component {

  /**
   * Use this lifeycle method to add event listeners
   */
  componentDidMount() {
    this.props.renderer.viewWillAppear();
  }

  componentWillUnmount() {
    this.props.renderer.viewWillDisappear();
  }

  componentWillReceiveProps(nextProps) {

    if (this.props.id === nextProps.id) {
      return;
    }

    const currentRenderer = this.props.renderer;
    const nextRenderer = nextProps.renderer;

    currentRenderer.viewWillDisappear();
    currentRenderer.viewWillUnload();
    nextRenderer.viewWillAppear();
  }

  render() {

    const domElement = this.props.renderer.render();

    return (
      <div
        id="camera-view"
        key={this.props.id.toString()}
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
