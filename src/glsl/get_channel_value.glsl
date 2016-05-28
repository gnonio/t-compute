float get_channel_value( sampler2D texture, int channel, vec2 xy ) {
	float value = 0.0;
	if ( channel == 0 ) {
		value = texture2D( texture, xy ).r;
	} else if ( channel == 1 ) {
		value = texture2D( texture, xy ).g;
	} else if ( channel == 2 ) {
		value = texture2D( texture, xy ).b;
	} else if ( channel == 3 ) {
		value = texture2D( texture, xy ).a;
	}	
	return value;
}
#pragma glslify: export(get_channel_value)