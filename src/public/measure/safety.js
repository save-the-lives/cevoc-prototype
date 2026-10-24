// Road-safety context for a speed reading. Facts come from how roads and cars are designed (the Safe System approach
// behind NSW's Towards Zero strategy) and from physics, not from scare figures. Statistics are marked as placeholders.
// PROTOTYPE COPY: wording and figures need sign-off from Transport for NSW's Centre for Road Safety before real use.

const stopMetres = (kmh) => { const v = kmh / 3.6; return v * 1.5 + (v * v) / (2 * 0.7 * 9.81); }; // 1.5 s to react, dry road
const round = (x) => Math.round(x);

const zone = (limit) => {
  if (limit <= 50) return { icon: 'person', text: 'Streets like this are where people walk, cycle and cross. Most people survive being hit by a car at 30 km/h. Far fewer do at 50.' };
  if (limit <= 70) return { icon: 'pin', text: `Roads at ${limit} km/h have crossings, driveways and intersections. They’re built around traffic moving at about that speed, with little room to stop or swerve.` };
  if (limit <= 90) return { icon: 'route', text: 'Roads like this often have oncoming traffic separated only by a line. At higher speeds there’s less time to correct a small mistake.' };
  return { icon: 'route', text: 'At highway speeds, the forces in a crash can be more than any car is built to protect people against.' };
};

export function safetyLines({ speed, limit, vehicle = '', dateTime = '' }) {
  const over = speed - limit;
  const hour = dateTime ? new Date(dateTime).getHours() : 12;
  const lines = [zone(limit)];

  if (/motor ?(cycle|bike)|rider|scooter/i.test(vehicle)) {
    lines.push({ icon: 'person', text: 'Riders have no frame around them, so a few km/h over the limit costs more if something goes wrong.' });
  } else if (/heavy|truck|prime mover/i.test(vehicle)) {
    lines.push({ icon: 'slow', text: 'A heavily loaded truck takes much further to stop, so the limit matters even more.' });
  } else if (hour >= 20 || hour < 5) {
    lines.push({ icon: 'eye', text: 'At night, headlights only reach so far. At higher speeds you may not be able to stop within the distance you can see.' });
  } else if (speed > 50) {
    lines.push({ icon: 'check', text: 'Cars are designed to protect people in side-on crashes up to about 50 km/h and head-on crashes up to about 70 km/h. Above that, protection falls away quickly.' });
  }

  if (over > 0) {
    const a = stopMetres(speed); const b = stopMetres(limit); const cars = Math.max(1, Math.round((a - b) / 4.5));
    lines.push({ icon: 'ruler', text: `At ${speed} km/h a car needs about ${round(a)} m to stop. At ${limit} km/h it needs about ${round(b)} m. That extra ${round(a - b)} m is roughly ${cars} car ${cars === 1 ? 'length' : 'lengths'}.`, foot: 'Assumes 1.5 seconds to react and a dry road.' });
  }
  return lines.slice(0, 3);
}
