import React from 'react';

class OrbitalMapView extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      mouseOverTarget: null,
    };
  }

  componentDidMount() {
    this.props.renderer.viewWillAppear();
    this.props.renderer.mouseOverCallback = (mouseOverTarget) => {
      this.setState({
        mouseOverTarget,
      });
    };
  }

  componentWillUnmount() {
    this.props.renderer.viewWillDisappear();
  }

  render() {

    const domElement = this.props.renderer.render();

    return (
      <div
        id="map-view"
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
