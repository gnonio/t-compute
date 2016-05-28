vec4 set_channel_value( int channel, float value ) {	
	if ( channel == 0 ) {
		return vec4( value, 0.0, 0.0, 0.0 );
	}
	if ( channel == 1 ) {
		return vec4( 0.0, value, 0.0, 0.0 );
	}
	if ( channel == 2 ) {
		return vec4( 0.0, 0.0, value, 0.0 );
	}
	if ( channel == 3 ) {
		return vec4( 0.0, 0.0, 0.0, value );
	}	
	return vec4( 0.0, 0.0, 0.0, 0.0 );	// should not happen
}
#pragma glslify: export(set_channel_value)