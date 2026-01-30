# Stellar Web - Particle System Specification

## Overview

The Stellar Web is an interactive 3D particle system visualization that creates a dynamic network of interconnected nodes floating in space. Particles move through 3D space, forming connections (edges) with nearby particles when they fall within a configurable connectivity radius.

## Core Features

### Particle System (Nodes)

- **Nodes**: Glowing particles that float and drift through 3D space
- **3D Movement**: Particles move in all three dimensions (x, y, z) with smooth velocity
- **Depth Perception**: Particles scale and fade based on their z-position to create depth illusion
- **Velocity**: Each node has randomized velocity vectors that create organic movement patterns

### Connections (Edges)

- **Dynamic Connectivity**: Edges form between nodes when their distance is less than the connectivity radius
- **Edge Thickness**: Line width that can be adjusted via slider
- **Edge Transparency/Opacity**: Edges fade based on distance - closer nodes have more opaque connections
- **Distance-Based Fading**: Edges become more transparent as nodes approach the connectivity radius limit

### Color Gradients

- **Edge Length Gradient**: Edge colors shift along a gradient based on the distance between connected nodes
  - Short edges: Warm colors (e.g., cyan/blue)
  - Long edges: Cool colors (e.g., purple/magenta)
- **Node Velocity Gradient**: Node colors change based on their current speed
  - Slow nodes: Cool, calm colors
  - Fast nodes: Warm, energetic colors

## Interactive Controls (Sliders)

| Control | Description | Range |
|---------|-------------|-------|
| **Node Count** | Number of particles in the system | 20 - 200 |
| **Connectivity Radius** | Maximum distance for edge connections | 50 - 300 |
| **Edge Thickness** | Line width of connections | 0.5 - 5 |
| **Edge Opacity** | Base transparency of edges | 0 - 1 |
| **Node Size** | Radius of particle nodes | 2 - 10 |
| **Node Speed** | Movement velocity multiplier | 0.1 - 3 |
| **Depth Range** | Z-axis range for 3D effect | 100 - 500 |

## Visual Design

### Color Palette
- **Background**: Deep space black (#0a0a0f)
- **Nodes**: Glowing white/cyan with velocity-based hue shift
- **Edges**: Gradient from cyan (#00ffff) to magenta (#ff00ff) based on length

### Effects
- **Glow Effect**: Nodes have a soft radial glow
- **Depth Blur**: Distant particles appear slightly smaller and more transparent
- **Smooth Animation**: 60fps animation using requestAnimationFrame

## Technical Implementation

### Technologies
- HTML5 Canvas for rendering
- Vanilla JavaScript for particle physics and interactions
- CSS for UI controls styling

### Architecture
1. **Particle Class**: Manages individual node properties and movement
2. **ParticleSystem Class**: Handles all particles, connections, and rendering
3. **UI Controller**: Manages slider inputs and updates system parameters

### Performance Considerations
- Spatial optimization for edge detection
- Efficient canvas rendering with minimal redraws
- Throttled UI updates to prevent performance issues

## File Structure

```
/
├── index.html      # Main webpage with canvas and controls
├── spec.md         # This specification document
└── README.md       # Project documentation (optional)
```
