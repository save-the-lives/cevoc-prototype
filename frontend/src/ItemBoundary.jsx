import { Component } from 'react';

/** Keeps a crash in one evidence item from taking down the page, and lets the person try that item again. */
export default class ItemBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? (
        <li className="card">
          <p role="alert">This item could not be shown.</p>
          <p><button type="button" className="linklike" onClick={() => this.setState({ failed: false })}>Try again</button></p>
        </li>
      )
      : this.props.children;
  }
}
