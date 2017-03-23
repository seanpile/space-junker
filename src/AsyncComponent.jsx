import React from 'react';

class AsyncComponent extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      Component: null,
    };
  }

  componentDidMount() {
      // Load the component now
    this.props.loader().then((Component) => {
      this.setState({
        Component: Component.default,
      });
    });
  }

  render() {
    const {
      Component,
    } = this.state;
    const {
      Placeholder,
    } = this.props;

    if (Component) {
      return <Component {...this.props} />;
    }

    return Placeholder;
  }

}

AsyncComponent.propTypes = {
  // A loader is a function that should return a Promise.
  loader: React.PropTypes.func.isRequired,

  // A placeholder to render while waiting completion.
  Placeholder: React.PropTypes.node.isRequired,
};

export default AsyncComponent;
