import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );

export function loadSyncPaths() {

	const raw = fs
		.readFileSync( path.join( __dirname, 'sync-paths.json' ), 'utf8' )
		.replace( /^\uFEFF/, '' );

	return JSON.parse( raw )
		.map( ( p ) => String( p ).trim().replace( /^\uFEFF/, '' ).replace( /\/+$/, '' ) )
		.filter( Boolean );

}
