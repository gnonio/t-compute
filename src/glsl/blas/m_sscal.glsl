void main( void ) {	
	float x_value = get_channel_value( X, Xchan, UVs );
	gl_FragColor = set_channel_value( OUTchan, alpha * x_value );
}