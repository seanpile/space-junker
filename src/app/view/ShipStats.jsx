import React from 'react';

function ShipStats(props) {

  const focus = props.focus;
  const propellant = focus.stages[0].propellant;
  const maxThrust = focus.stages[0].thrust / 1000;
  const specificImpulse = focus.stages[0].isp;
  const thrustLevel = focus.motion.thrust;

  const stats = [
    ['Propellant', `${propellant.toFixed(2)} kg`],
    ['Thrust', `${(thrustLevel * maxThrust).toFixed(2)} / ${maxThrust.toFixed(2)} kN`],
    ['Specific Impulse', `${specificImpulse} s`],
  ];

  const elements = stats.map((stat, idx) => (
    <div key={idx.toString()} className="hud-overlay-entry">
      <div className="label">{stat[0]}</div>
      <div className="value">{stat[1]}</div>
    </div>
    ));

  return (
    <div id="ship-stats-component">
      <h3 className="title">Ship</h3>
      {elements}
    </div>
  );
}

/* eslint object-curly-newline: ["error", { minProperties: 1 }] */
ShipStats.prototype.propTypes = {
  focus: React.PropTypes.shape({
    motion: React.PropTypes.shape({
      thrust: React.PropTypes.number.isRequired,
    }).isRequired,
  }).isRequired,
};

export default ShipStats;
