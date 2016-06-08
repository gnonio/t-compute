void main( void ) {
	float A_value = get_channel_value( A, Achan, UVs );
	gl_FragColor = set_channel_value( OUTchan, A_value );
}
