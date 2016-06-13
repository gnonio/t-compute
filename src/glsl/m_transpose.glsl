void main( void ) {	
	float value = get_channel_value( A, Achan, vec2( UVs.y, UVs.x ) );	
	gl_FragColor = set_channel_value( OUTchan, value );
}