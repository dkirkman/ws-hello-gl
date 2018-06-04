import React, {Component} from 'react';
import './demon.css';
import hello_world from './hello-gl.js';

class HelloGL extends Component {
  constructor(props) {   
    super(props);

    this.width = 630;
    this.height = 400;

    this.canvasRef = React.createRef();
    this.controlRef = React.createRef();
  }

  componentDidMount() {
    let canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;

    this.canvasRef.current.appendChild(canvas);

    let meshsize = 30;
    if (this.props.meshsize !== undefined) meshsize = Number(this.props.meshsize);

    let lighting = "uniform";
    if (this.props.lighting !== undefined) lighting = this.props.lighting;

    let useTexturedEarth = false;
    if (this.props.useTexturedEarth === "true") useTexturedEarth = true;

    hello_world(this.controlRef.current, canvas, meshsize, lighting, useTexturedEarth);
  }

  render() {
    return (
      <p>
        <div className="demon" style={{width:630, 
                                       'margin-left': 'auto',
                                       'margin-right': 'auto',
                                       'display': 'block'
             }}>
          <div className="demon" ref={this.controlRef}
               style={{height: 0,
                       float: 'right',
                       'z-index': 0,
                       position: 'relative',
                       top: 0,
                       left: 0}}>
          </div>
          
          <div ref={this.canvasRef}>
          </div>
        </div>
      </p>
    );
  }
}

export default HelloGL;
