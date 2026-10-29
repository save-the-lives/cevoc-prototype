import { Component } from 'react';

/** Keeps a crash in one evidence item from taking down the page. */
export default class ItemBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <li className="card"><p role="alert">This item could not be shown.</p></li>
      : this.props.children;
  }
}
