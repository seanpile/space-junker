import React from 'react';
import { AU, PLANET_TYPE } from '../Constants';

function OrbitalStatsOverlay(props) {
  const focus = props.focus;
  const velocity = focus.derived.velocity.length() * AU;
  const eccentricity = focus.orbit.e || 0;
  const semiMajorAxis = (focus.derived.semiMajorAxis * AU) / 1000;
  const semiMinorAxis = (focus.derived.semiMinorAxis * AU) / 1000;
  const rotationPeriod = focus.constants.rotation_period || 0;
  const axialTilt = focus.constants.axial_tilt || 0;
  const orbitalPeriod = (focus.derived.orbitalPeriod || 0) / 86400;

  let distance = 0;
  let periapsis = 0;
  let apoapsis = 0;
  if (focus.primary) {
    const r = focus.derived.position.clone().sub(focus.primary.derived.position);
    distance = ((r.length() - focus.primary.constants.radius) * AU) / 1000;
    periapsis = ((focus.derived.periapsis.clone().sub(focus.primary.derived.position).length() -
      focus.primary.constants.radius) * AU) / 1000;

    if (focus.derived.apoapsis) {
      apoapsis = ((focus.derived.apoapsis.clone().sub(focus.primary.derived.position).length() -
        focus.primary.constants.radius) * AU) / 1000;
    } else {
      apoapsis = NaN;
    }
  }

  const stats = [
    [
      'Name', focus.name,
    ],
    [
      'Orbiting', focus.primary
          ? focus.primary.name
          : '',
    ],
    [
      'Speed', `${velocity.toFixed(2)} m/s`,
    ],
    [
      'Orbit Distance', `${distance.toFixed(2)} km`,
    ],
    [
      'Periapsis', `${periapsis.toFixed(2)} km`,
    ],
    [
      'Apoapsis', `${isNaN(apoapsis) ? 'Undefined' : `${apoapsis.toFixed(2)} km`}`,
    ],
    [
      'Eccentricity', `${eccentricity.toFixed(4)}`,
    ],
    [
      'Semi-Major Axis', `${semiMajorAxis.toFixed(2)} km`,
    ],
    [
      'Semi-Minor Axis', `${semiMinorAxis.toFixed(2)} km`,
    ],
    ['Orbital Period', `${orbitalPeriod === Infinity ? `${orbitalPeriod}` : `${orbitalPeriod.toFixed(4)} days`}`],
  ];

  if (focus.type === PLANET_TYPE) {
    stats.push(['Rotation Period', `${rotationPeriod.toFixed(4)} days`]);
    stats.push(['Axial Tilt', `${axialTilt.toFixed(2)}°`]);
  }

  const elements = stats.map((pair, idx) => (
    <div key={idx.toString()} className="hud-overlay-entry">
      <div className="label">{pair[0]}</div>
      <div className="value">{pair[1]}</div>
    </div>
      ));

  return (
    <div className="hud-overlay">
      <h3 className="title">Orbital Statistics</h3>
      {elements}
    </div>
  );
}

OrbitalStatsOverlay.prototype.propTypes = {
  focus: React.PropTypes.shape({
    name: React.PropTypes.string,
  }).isRequired,
};


export default OrbitalStatsOverlay;
