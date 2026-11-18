import { Component } from 'react'
import { reportAnnouncementRuntimeIssue } from '../model/use-announcement-runtime-health'

export default class AnnouncementStripBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    reportAnnouncementRuntimeIssue({
      surface: this.props.surface,
      event: 'render_error',
      reason: 'render',
    })
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}
