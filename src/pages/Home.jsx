import React from 'react';
import { Link, Alert } from '../components/ui.jsx';

function Card({ to, title, children, tone }) {
  return (
    <Link to={to} className={`nsw-card ${tone ? `nsw-card--${tone}` : ''}`}>
      <span className="nsw-card__title">{title}</span>
      <span className="nsw-card__copy">{children}</span>
      <span className="nsw-card__arrow" aria-hidden="true">→</span>
    </Link>
  );
}

export default function Home() {
  return (
    <>
      <section className="nsw-hero">
        <div className="nsw-container">
          <h1>Camera enforcement information</h1>
          <p className="nsw-intro">
            View the details and images of a camera-detected offence, find out about the camera that recorded it, and check that the camera was certified at the time.
          </p>
        </div>
      </section>

      <div className="nsw-container cevoc-page">
        <div className="nsw-grid nsw-grid--2">
          <Card to="/notice" title="View your offence">
            Use the details on your penalty notice to see the offence images, camera location and certification.
          </Card>
          <Card to="/cameras" title="Check a camera and its certification">
            Search for a camera location and see whether it was certified on a particular date.
          </Card>
        </div>

        <Alert type="info" title="Came here from Revenue NSW?">
          <p>
            You can view your offence details here, then return to Revenue NSW to pay, request a review or nominate a driver. Have your penalty notice number and vehicle registration ready.
          </p>
        </Alert>

        <h2 className="cevoc-h2">What you'll need</h2>
        <ul className="cevoc-list">
          <li>Your 10-digit penalty notice number</li>
          <li>The registration number of the vehicle on the notice</li>
        </ul>
      </div>
    </>
  );
}
