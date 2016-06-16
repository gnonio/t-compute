vec2 getUV( float index, vec2 shape, vec2 halfp ) {
	float x = modulo( index, shape.x ); // custom mod function addressing float division rounding error
	float y = floor( ( index + 0.5 ) / shape.x ); // as above
	
	return vec2( x * halfp.x * 2.0 + halfp.x, y * halfp.y * 2.0 + halfp.y );
}
