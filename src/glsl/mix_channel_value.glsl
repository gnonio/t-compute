vec4 mix_channel_value( vec4 rgba, int channel, float value ) {	
	if ( channel == 0 ) {
		rgba.r = value;
	}
	if ( channel == 1 ) {
		rgba.g = value;
	}
	if ( channel == 2 ) {
		rgba.b = value;
	}
	if ( channel == 3 ) {
		rgba.a = value;
	}
	return rgba;
}
#pragma glslify: export(mix_channel_value)