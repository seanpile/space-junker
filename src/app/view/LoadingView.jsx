import React from 'react';
import { Splash } from 'splash-screen';
import 'splash/splash.min.css';

class LoadingView extends React.Component {

  componentDidMount() {
    Splash.enable('spinner-section-far');
  }

  componentWillUnmount() {
    Splash.destroy();
  }

  render() {
    return (
      <div id="loading">Loading textures, this may take a moment.</div>
    );
  }

}

export default LoadingView;
