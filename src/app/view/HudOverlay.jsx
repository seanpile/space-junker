import React from 'react';

import WarpOverlay from './WarpOverlay';
import OrbitalStatsOverlay from './OrbitalStatsOverlay';
import ShipOverlay from './ShipOverlay';

class HudOverlay extends React.Component {

  render() {

    const elapsed = this.props.elapsed;
    const timeWarpValues = this.props.timeWarpValues;
    const timeWarpIdx = this.props.timeWarpIdx;
    const stats = this.props.stats;
    const focus = this.props.focus;

    return (
      <div id="hud">
        <WarpOverlay
          idx={timeWarpIdx}
          values={timeWarpValues}
          elapsed={elapsed}
        />

        <OrbitalStatsOverlay focus={focus} />

        <ShipOverlay focus={focus} />

        <div
          className="hud-overlay"
          id="stats-overlay"
          ref={(ref) => {
            if (ref) {
              stats.dom.id = 'stats';
              stats.dom.style.cssText = '';
              ref.appendChild(stats.dom);
            }
          }}
        />

      </div>);
  }

}

HudOverlay.propTypes = {
  timeWarpIdx: React.PropTypes.number.isRequired,
  timeWarpValues: React.PropTypes.arrayOf(React.PropTypes.number).isRequired,
};

export default HudOverlay;
