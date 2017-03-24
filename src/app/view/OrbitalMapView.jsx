import React from 'react';

class OrbitalMapView extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      mouseOverTarget: null,
    };
  }

  initRenderer(renderer) {
    renderer.viewWillAppear();
    renderer.mouseOverCallback = (mouseOverTarget) => {
      this.setState({
        mouseOverTarget,
      });
    };
  }

  componentDidMount() {
    this.initRenderer(this.props.renderer);
  }

  componentWillUnmount() {
    this.props.renderer.viewWillDisappear();
  }

  componentWillReceiveProps(nextProps) {

    if (this.props.id === nextProps.id) {
      return;
    }

    // Initialize new renderer
    const currentRenderer = this.props.renderer;
    const nextRenderer = nextProps.renderer;

    currentRenderer.viewWillDisappear();
    currentRenderer.viewWillUnload();

    this.initRenderer(nextRenderer);
  }

  render() {

    const domElement = this.props.renderer.render();

    return (
      <div
        id="map-view"
        key={this.props.id.toString()}
        ref={(ref) => {
          if (ref) {
            domElement.className = 'three-canvas';
            ref.appendChild(domElement);
          }
        }}
      >

        {this.state.mouseOverTarget &&
          (<div
            id="map-mouse-overlay"
            style={{
              bottom: this.state.mouseOverTarget.bottom,
              left: this.state.mouseOverTarget.left,
            }}
          >
            <h5 className="body-name">{this.state.mouseOverTarget.name}</h5>
          </div>)}
      </div>

    );
  }

}

export default OrbitalMapView;
