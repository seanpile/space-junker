import React from 'react';

class HelpOverlay extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      isDisplayed: false,
    };

    this.toggleHelp = this.toggleHelp.bind(this);
  }

  toggleHelp() {
    this.setState(prevState => ({
      isDisplayed: !prevState.isDisplayed,
    }));
  }

  render() {

    const helpMenu = [
      {
        keys: ['[', ']'],
        description: 'Toggle between Planets',
      },
      {
        keys: [',', '.'],
        description: 'Slow down / Speed up',
      },
      {
        keys: ['c'],
        description: 'Reset the camera',
      },
      {
        keys: ['m'],
        description: 'Toggle View',
      },
      {
        keys: ['space'],
        description: 'Pause',
      },
      {
        keys: ['-'],
        description: 'Decrease Thrust',
      },
      {
        keys: ['+'],
        description: 'Increase Thrust',
      },
      {
        keys: ['w', 's'],
        description: 'Pitch Up / Down',
      },
      {
        keys: ['a', 'd'],
        description: 'Yaw Left / Right',
      },
      {
        keys: ['q', 'e'],
        description: 'Pitch Up / Down',
      },
      {
        keys: ['t'],
        description: 'Toggle Stability Assist',
      },
    ];

    const elements = helpMenu.map((helpEntry, idx) => {

      const keys = helpEntry.keys.map(
      (key, kIdx) => (<div key={kIdx.toString()} className="key">{key}</div>));

      return (
        <div key={idx.toString()} className="key-entry">
          <div className="keys">{keys}</div>
          <div className="description">{helpEntry.description}</div>
        </div>
      );
    });

    return (
      <div id="help">
        <button className="help-button" onClick={this.toggleHelp}>?</button>
        {this.state.isDisplayed &&
          (<div id="help-overlay">
            <button className="close-button" onClick={this.toggleHelp}>X</button>
            <h3 className="title">Help</h3>
            {elements}
          </div>)
        }
      </div>
    );
  }

}

export default HelpOverlay;
