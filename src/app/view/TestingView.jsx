import React from 'react';

class TestingView extends React.Component {

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
        id="testing-view"
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

export default TestingView;
