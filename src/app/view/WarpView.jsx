import moment from 'moment';
import React from 'react';

function WarpView(props) {

  const warpIdx = props.idx;
  const warpValues = props.values.map((value, idx) => {
    let className;
    if (idx <= warpIdx) {
      className = 'warp-enabled';
    } else {
      className = 'warp-disabled';
    }
    return (<div key={idx.toString()} className={className} />);
  });

  const elapsed = props.elapsed;
  const years = elapsed.years();
  const months = elapsed.months();
  const days = elapsed.days() + (months * 30);
  const hours = elapsed.hours();
  const minutes = elapsed.minutes();
  const seconds = elapsed.seconds();

  const values = [];

  if (years > 0) {
    values.push(`${years}Y`);
  }

  if (days > 0) {
    values.push(`${days}d`);
  }

  values.push(hours.toString().padStart(2, '0'));
  values.push(minutes.toString().padStart(2, '0'));
  values.push(seconds.toString().padStart(2, '0'));

  const missionClock = `+T ${values.join(':')}`;
  const status = props.isRunning
      ? 'Active Mission'
      : 'Game Paused';

  return (
    <div id="warp-view-component">
      <div id="warp">
        <div id="warp-values">
          {warpValues}
        </div>
        <div id="warp-description">Warp</div>
      </div>
      <div id="time-section">
        <div id="time">{missionClock}</div>
        <div
          id="time-status" className={props.isRunning
            ? 'status-running'
            : 'status-paused'}
        >{status}</div>
      </div>
    </div>
  );
}

WarpView.prototype.propTypes = {
  idx: React.PropTypes.number.isRequired,
  values: React.PropTypes.arrayOf(React.PropTypes.number).isRequired,
  isRunning: React.PropTypes.bool.isRequired,
  elapsed: React.PropTypes.instanceOf(moment).isRequired,
};

export default WarpView;
