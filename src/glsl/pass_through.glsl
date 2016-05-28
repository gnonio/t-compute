// Quad pass-through
precision highp float;

attribute vec3 position;
attribute vec2 uv;
varying vec2   UVs;

void main( void ) {
	gl_Position = vec4( position, 1.0 );
	UVs = uv;
}
