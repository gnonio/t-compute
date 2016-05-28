// UNPACKED
precision highp float;

varying vec2		UVs;			// texture coords of row/column to calculate

uniform sampler2D	A;				// texture with unpacked data A
uniform int			A_channel;		// channel to read data from

uniform int			write_channel;	// channel to write texture to

#pragma glslify: get_channel_value = require(./get_channel_value)
#pragma glslify: set_channel_value = require(./set_channel_value)

void main( void ) {
	float A_value = get_channel_value( A, A_channel, UVs );
	gl_FragColor = set_channel_value( write_channel, A_value );
}