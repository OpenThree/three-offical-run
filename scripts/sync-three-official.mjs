#!/usr/bin/env node
/**
 * 从 three.js 官方仓库同步 build 与 examples 资源目录到本仓库。
 * 默认跟踪 dev 分支（与 REVISION 如 184dev 一致）。
 *
 * 用法:
 *   node scripts/sync-three-official.mjs
 *   node scripts/sync-three-official.mjs --branch dev
 *   node scripts/sync-three-official.mjs --dry-run
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const ROOT = path.resolve( __dirname, '..' );
const CACHE_DIR = path.join( ROOT, '.three-sync-cache', 'three.js' );
const REPO_URL = 'https://github.com/mrdoob/three.js.git';
const LOG_PATH = path.join( ROOT, '.three-sync-cache', 'last-sync.json' );
const PATHS_FILE = path.join( __dirname, 'sync-paths.json' );

/** 仅此列表中的目录会被删除并用官方同名目录完整替换 */
const SYNC_PATHS = JSON.parse( fs.readFileSync( PATHS_FILE, 'utf8' ) ).map( ( rel ) => ( {
	from: rel,
	to: rel,
} ) );

function parseArgs() {

	const args = process.argv.slice( 2 );
	let branch = process.env.THREE_SYNC_BRANCH || 'dev';
	let dryRun = false;

	for ( let i = 0; i < args.length; i ++ ) {

		if ( args[ i ] === '--branch' && args[ i + 1 ] ) {

			branch = args[ ++ i ];

		} else if ( args[ i ] === '--dry-run' ) {

			dryRun = true;

		} else if ( args[ i ] === '--help' || args[ i ] === '-h' ) {

			console.log( `
用法: node scripts/sync-three-official.mjs [选项]

选项:
  --branch <name>   同步的分支或标签（默认 dev，可用环境变量 THREE_SYNC_BRANCH）
  --dry-run         仅拉取官方仓库，不覆盖本地目录
  -h, --help        显示帮助
` );
			process.exit( 0 );

		}

	}

	return { branch, dryRun };

}

function run( command, args, options = {} ) {

	const result = spawnSync( command, args, {
		stdio: 'inherit',
		cwd: options.cwd,
		shell: process.platform === 'win32',
		...options,
	} );

	if ( result.status !== 0 ) {

		const detail = [ command, ...args ].join( ' ' );
		throw new Error( `命令失败 (${ result.status }): ${ detail }` );

	}

}

function ensureGitRepo( branch ) {

	fs.mkdirSync( path.dirname( CACHE_DIR ), { recursive: true } );

	const gitDir = path.join( CACHE_DIR, '.git' );

	if ( ! fs.existsSync( gitDir ) ) {

		console.log( `[sync] 首次克隆 ${ REPO_URL } (分支 ${ branch })…` );
		run( 'git', [
			'clone',
			'--depth',
			'1',
			'--branch',
			branch,
			'--single-branch',
			REPO_URL,
			CACHE_DIR,
		] );
		return;

	}

	console.log( `[sync] 更新官方仓库 (${ branch })…` );
	run( 'git', [ '-C', CACHE_DIR, 'fetch', 'origin', branch, '--depth', '1' ], { shell: false } );
	run( 'git', [ '-C', CACHE_DIR, 'checkout', '-B', branch, `origin/${ branch }` ], { shell: false } );
	run( 'git', [ '-C', CACHE_DIR, 'reset', '--hard', `origin/${ branch }` ], { shell: false } );

}

function readRevision() {

	const corePath = path.join( CACHE_DIR, 'build', 'three.core.js' );

	if ( ! fs.existsSync( corePath ) ) return null;

	const text = fs.readFileSync( corePath, 'utf8' );
	const match = text.match( /const\s+REVISION\s*=\s*'([^']+)'/ );

	return match ? match[ 1 ] : null;

}

function replaceDir( src, dest, dryRun ) {

	if ( ! fs.existsSync( src ) ) {

		throw new Error( `官方路径不存在: ${ src }` );

	}

	if ( dryRun ) {

		console.log( `[dry-run] 将覆盖: ${ path.relative( ROOT, dest ) }` );
		return;

	}

	fs.mkdirSync( path.dirname( dest ), { recursive: true } );
	fs.rmSync( dest, { recursive: true, force: true } );
	fs.cpSync( src, dest, { recursive: true } );

}

function syncPaths( dryRun ) {

	for ( const { from, to } of SYNC_PATHS ) {

		const src = path.join( CACHE_DIR, from );
		const dest = path.join( ROOT, to );
		console.log( `[sync] ${ to }` );
		replaceDir( src, dest, dryRun );

	}

}

function writeLog( branch, revision, dryRun ) {

	if ( dryRun || process.env.CI ) return;

	const log = {
		branch,
		revision,
		syncedAt: new Date().toISOString(),
		paths: SYNC_PATHS.map( ( p ) => p.to ),
	};

	fs.mkdirSync( path.dirname( LOG_PATH ), { recursive: true } );
	fs.writeFileSync( LOG_PATH, JSON.stringify( log, null, 2 ) + '\n', 'utf8' );

}

function main() {

	const { branch, dryRun } = parseArgs();

	console.log( `[sync] 项目根目录: ${ ROOT }` );
	console.log( `[sync] 分支: ${ branch }${ dryRun ? ' (dry-run)' : '' }` );

	ensureGitRepo( branch );

	const revision = readRevision();
	if ( revision ) console.log( `[sync] 官方 REVISION: ${ revision }` );

	syncPaths( dryRun );
	writeLog( branch, revision, dryRun );

	console.log( dryRun ? '[sync] dry-run 完成。' : '[sync] 同步完成。' );

}

try {

	main();

} catch ( err ) {

	console.error( '[sync] 错误:', err.message );
	process.exit( 1 );

}
