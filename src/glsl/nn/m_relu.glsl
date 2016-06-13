void main( void ) {
	float row_t = UVs.y;
	float col_t = UVs.x;

	float value = get_channel_value( A, Achan, UVs );
	float relu = max( value, 0.0 );

	gl_FragColor = set_channel_value( OUTchan, relu );
}
