# BotVisibility WordPress Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WordPress plugin that self-scans against all 30 BotVisibility L1-L3 checks, displays results in a dark-themed admin UI matching botvisibility.com, and generates/serves missing AI agent readiness files.

**Architecture:** Monolithic PHP plugin using WordPress rewrite API for virtual routes, WP REST API introspection for OpenAPI generation, and AJAX-driven admin UI with scoped dark-theme CSS. All scanning is local — no external API calls.

**Tech Stack:** PHP 7.4+, WordPress 6.0+ APIs (Settings, Options, Rewrite, REST, WP-Cron, Transients), vanilla JS for admin UI.

**Spec:** `docs/superpowers/specs/2026-03-30-wordpress-plugin-design.md`

---

## File Structure

```
wordpress-plugin/botvisibility/
├── botvisibility.php              # Main plugin file: header, constants, includes, activation/deactivation hooks
├── uninstall.php                  # Clean uninstall: remove options, static files
├── includes/
│   ├── class-scoring.php          # LEVELS, CHECK_DEFINITIONS arrays, calculateLevelProgress(), getCurrentLevel()
│   ├── class-scanner.php          # 30 check methods, run_all_checks(), result caching
│   ├── class-file-generator.php   # Generate content for llms.txt, agent-card.json, ai.json, skill.md, etc.
│   ├── class-openapi-generator.php # Introspect WP REST API routes → OpenAPI 3.0 spec
│   ├── class-virtual-routes.php   # Register rewrite rules, handle requests, serve generated files
│   ├── class-meta-tags.php        # Inject <meta> and <link> tags into wp_head
│   ├── class-admin.php            # Register admin menu, enqueue assets, render tabs, AJAX handlers
│   └── class-rest-enhancer.php    # Add CORS, rate limit, caching, idempotency headers to REST API
├── admin/
│   ├── css/admin.css              # Scoped dark theme matching botvisibility.com
│   ├── js/admin.js                # AJAX scanning, tab navigation, fix buttons, progressive display
│   └── views/
│       ├── dashboard.php          # Score overview: thermometer, level bars, quick actions
│       ├── level-detail.php       # Check list with expand/collapse, fix buttons (reused per level)
│       ├── file-generator.php     # File manager table: preview, edit, enable/disable, export
│       └── settings.php           # Site description, capabilities, toggles, auto-scan schedule
├── templates/
│   ├── llms-txt.php               # llms.txt content template
│   ├── agent-card.php             # agent-card.json template
│   ├── ai-json.php                # ai.json template
│   ├── skill-md.php               # skill.md template
│   ├── skills-index.php           # skills/index.json template
│   ├── mcp-json.php               # mcp.json template
│   └── openid-configuration.php   # openid-configuration template
└── assets/
    └── logo.svg                   # BotVisibility logo
```

---

## Task 1: Plugin Bootstrap & Scoring (Foundation)

**Files:**
- Create: `wordpress-plugin/botvisibility/botvisibility.php`
- Create: `wordpress-plugin/botvisibility/uninstall.php`
- Create: `wordpress-plugin/botvisibility/includes/class-scoring.php`

- [ ] **Step 1: Create plugin directory structure**

```bash
mkdir -p wordpress-plugin/botvisibility/{includes,admin/{css,js,views},templates,assets}
```

- [ ] **Step 2: Create main plugin file**

Create `wordpress-plugin/botvisibility/botvisibility.php`:

```php
<?php
/**
 * Plugin Name: BotVisibility
 * Plugin URI: https://botvisibility.com
 * Description: Scan your WordPress site for AI agent readiness and auto-generate missing discovery files (llms.txt, agent-card.json, OpenAPI spec, and more).
 * Version: 1.0.0
 * Author: BotVisibility
 * Author URI: https://botvisibility.com
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: botvisibility
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'BOTVIS_VERSION', '1.0.0' );
define( 'BOTVIS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'BOTVIS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'BOTVIS_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

// Include classes.
require_once BOTVIS_PLUGIN_DIR . 'includes/class-scoring.php';
require_once BOTVIS_PLUGIN_DIR . 'includes/class-scanner.php';
require_once BOTVIS_PLUGIN_DIR . 'includes/class-file-generator.php';
require_once BOTVIS_PLUGIN_DIR . 'includes/class-openapi-generator.php';
require_once BOTVIS_PLUGIN_DIR . 'includes/class-virtual-routes.php';
require_once BOTVIS_PLUGIN_DIR . 'includes/class-meta-tags.php';
require_once BOTVIS_PLUGIN_DIR . 'includes/class-admin.php';
require_once BOTVIS_PLUGIN_DIR . 'includes/class-rest-enhancer.php';

/**
 * Plugin activation.
 */
function botvis_activate() {
    $defaults = array(
        'site_description'    => get_bloginfo( 'description' ),
        'capabilities'        => array( 'content' ),
        'enable_cors'         => false,
        'enable_cache_headers' => false,
        'enable_rate_limits'  => false,
        'enable_idempotency'  => false,
        'robots_ai_policy'    => 'allow',
        'auto_scan_schedule'  => 'weekly',
        'static_export_path'  => ABSPATH,
        'enabled_files'       => array(
            'llms-txt'       => true,
            'agent-card'     => true,
            'ai-json'        => true,
            'skill-md'       => true,
            'skills-index'   => true,
            'openapi'        => true,
            'mcp-json'       => true,
        ),
        'custom_content'      => array(),
        'remove_files_on_deactivate' => false,
    );

    if ( false === get_option( 'botvisibility_options' ) ) {
        add_option( 'botvisibility_options', $defaults );
    }

    // Register virtual routes.
    BotVisibility_Virtual_Routes::register_rewrite_rules();
    flush_rewrite_rules();

    // Schedule auto-scan.
    if ( ! wp_next_scheduled( 'botvis_auto_scan' ) ) {
        wp_schedule_event( time(), 'weekly', 'botvis_auto_scan' );
    }
}
register_activation_hook( __FILE__, 'botvis_activate' );

/**
 * Plugin deactivation.
 */
function botvis_deactivate() {
    flush_rewrite_rules();
    wp_clear_scheduled_hook( 'botvis_auto_scan' );

    $options = get_option( 'botvisibility_options', array() );
    if ( ! empty( $options['remove_files_on_deactivate'] ) ) {
        BotVisibility_File_Generator::remove_static_files();
    }
}
register_deactivation_hook( __FILE__, 'botvis_deactivate' );

// Initialize plugin components.
add_action( 'init', array( 'BotVisibility_Virtual_Routes', 'register_rewrite_rules' ) );
add_action( 'template_redirect', array( 'BotVisibility_Virtual_Routes', 'handle_request' ) );
add_action( 'wp_head', array( 'BotVisibility_Meta_Tags', 'output_meta_tags' ) );
add_action( 'rest_api_init', array( 'BotVisibility_REST_Enhancer', 'init' ) );
add_action( 'botvis_auto_scan', array( 'BotVisibility_Scanner', 'run_scheduled_scan' ) );

if ( is_admin() ) {
    BotVisibility_Admin::init();
}
```

- [ ] **Step 3: Create uninstall.php**

Create `wordpress-plugin/botvisibility/uninstall.php`:

```php
<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

delete_option( 'botvisibility_options' );
delete_transient( 'botvis_scan_results' );

// Remove static exported files.
$well_known = ABSPATH . '.well-known/';
$files = array(
    ABSPATH . 'llms.txt',
    ABSPATH . 'skill.md',
    ABSPATH . 'openapi.json',
    $well_known . 'agent-card.json',
    $well_known . 'ai.json',
    $well_known . 'skills/index.json',
    $well_known . 'mcp.json',
    $well_known . 'openid-configuration',
);

foreach ( $files as $file ) {
    if ( file_exists( $file ) ) {
        unlink( $file );
    }
}

// Clean up empty directories.
if ( is_dir( $well_known . 'skills' ) ) {
    rmdir( $well_known . 'skills' );
}
```

- [ ] **Step 4: Create scoring class**

Create `wordpress-plugin/botvisibility/includes/class-scoring.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class BotVisibility_Scoring {

    /**
     * Level definitions.
     */
    const LEVELS = array(
        1 => array(
            'number'      => 1,
            'name'        => 'Discoverable',
            'color'       => '#ef4444',
            'description' => 'Bots can find you. Your site exposes the metadata and machine-readable files that let AI agents know you exist.',
        ),
        2 => array(
            'number'      => 2,
            'name'        => 'Usable',
            'color'       => '#f59e0b',
            'description' => 'Your API works for agents. Authentication, error handling, and core operations are agent-compatible.',
        ),
        3 => array(
            'number'      => 3,
            'name'        => 'Optimized',
            'color'       => '#22c55e',
            'description' => 'Agents can work efficiently. Pagination, filtering, and caching reduce token waste and round-trips.',
        ),
    );

    /**
     * All 30 check definitions.
     */
    const CHECK_DEFINITIONS = array(
        // Level 1: Discoverable (14)
        array( 'id' => '1.1',  'name' => 'llms.txt',                  'level' => 1, 'category' => 'Discoverable', 'description' => 'A /.well-known/llms.txt or /llms.txt file exists with machine-readable site information.' ),
        array( 'id' => '1.2',  'name' => 'Agent Card',                'level' => 1, 'category' => 'Discoverable', 'description' => 'An agent card (/.well-known/agent-card.json) describes capabilities for AI agents.' ),
        array( 'id' => '1.3',  'name' => 'OpenAPI Spec',              'level' => 1, 'category' => 'Discoverable', 'description' => 'An OpenAPI/Swagger specification is publicly accessible.' ),
        array( 'id' => '1.4',  'name' => 'robots.txt AI Policy',      'level' => 1, 'category' => 'Discoverable', 'description' => 'robots.txt includes directives for AI crawlers and agents.' ),
        array( 'id' => '1.5',  'name' => 'Documentation Accessibility','level' => 1, 'category' => 'Discoverable', 'description' => 'Developer documentation is publicly accessible without authentication.' ),
        array( 'id' => '1.6',  'name' => 'CORS Headers',              'level' => 1, 'category' => 'Discoverable', 'description' => 'CORS headers allow cross-origin API access for browser-based agents.' ),
        array( 'id' => '1.7',  'name' => 'AI Meta Tags',              'level' => 1, 'category' => 'Discoverable', 'description' => 'HTML meta tags (llms:description, llms:url, llms:instructions) help AI agents discover site capabilities.' ),
        array( 'id' => '1.8',  'name' => 'Skill File',                'level' => 1, 'category' => 'Discoverable', 'description' => 'A /skill.md file provides structured agent instructions with YAML frontmatter.' ),
        array( 'id' => '1.9',  'name' => 'AI Site Profile',           'level' => 1, 'category' => 'Discoverable', 'description' => 'A /.well-known/ai.json file describes the site name, capabilities, and skill links.' ),
        array( 'id' => '1.10', 'name' => 'Skills Index',              'level' => 1, 'category' => 'Discoverable', 'description' => 'A /.well-known/skills/index.json lists all available agent skills.' ),
        array( 'id' => '1.11', 'name' => 'Link Headers',              'level' => 1, 'category' => 'Discoverable', 'description' => 'HTML <link> elements in <head> point to llms.txt, ai.json, or agent-card.json.' ),
        array( 'id' => '1.12', 'name' => 'MCP Server',                'level' => 1, 'category' => 'Discoverable', 'description' => 'A Model Context Protocol server endpoint is discoverable at /.well-known/mcp.json.' ),
        array( 'id' => '1.13', 'name' => 'Page Token Efficiency',     'level' => 1, 'category' => 'Discoverable', 'description' => 'The homepage HTML is token-efficient for LLM consumption.' ),
        array( 'id' => '1.14', 'name' => 'RSS/Atom Feed',             'level' => 1, 'category' => 'Discoverable', 'description' => 'An RSS or Atom feed provides structured content for agents.' ),

        // Level 2: Usable (9)
        array( 'id' => '2.1', 'name' => 'API Read Operations',       'level' => 2, 'category' => 'Usable', 'description' => 'Read operations (list, get, search) are available via API.' ),
        array( 'id' => '2.2', 'name' => 'API Write Operations',      'level' => 2, 'category' => 'Usable', 'description' => 'Write operations (create, update, delete) are available via API.' ),
        array( 'id' => '2.3', 'name' => 'API Primary Action',        'level' => 2, 'category' => 'Usable', 'description' => 'The primary value action of the app is available via API.' ),
        array( 'id' => '2.4', 'name' => 'API Key Authentication',    'level' => 2, 'category' => 'Usable', 'description' => 'API key authentication is supported.' ),
        array( 'id' => '2.5', 'name' => 'Scoped API Keys',           'level' => 2, 'category' => 'Usable', 'description' => 'API keys can be scoped to specific permissions.' ),
        array( 'id' => '2.6', 'name' => 'OpenID Configuration',      'level' => 2, 'category' => 'Usable', 'description' => 'An OpenID Connect discovery document is available.' ),
        array( 'id' => '2.7', 'name' => 'Structured Error Responses', 'level' => 2, 'category' => 'Usable', 'description' => 'All API errors return structured JSON with error codes.' ),
        array( 'id' => '2.8', 'name' => 'Async Operations',          'level' => 2, 'category' => 'Usable', 'description' => 'Long-running operations return a job ID with pollable status.' ),
        array( 'id' => '2.9', 'name' => 'Idempotency Support',       'level' => 2, 'category' => 'Usable', 'description' => 'Write endpoints support idempotency keys.' ),

        // Level 3: Optimized (7)
        array( 'id' => '3.1', 'name' => 'Sparse Fields',             'level' => 3, 'category' => 'Optimized', 'description' => 'A fields parameter exists to request only needed fields.' ),
        array( 'id' => '3.2', 'name' => 'Cursor Pagination',         'level' => 3, 'category' => 'Optimized', 'description' => 'List endpoints use cursor-based pagination.' ),
        array( 'id' => '3.3', 'name' => 'Search & Filtering',        'level' => 3, 'category' => 'Optimized', 'description' => 'Resources can be filtered by common attributes.' ),
        array( 'id' => '3.4', 'name' => 'Bulk Operations',           'level' => 3, 'category' => 'Optimized', 'description' => 'Batch create/update/delete endpoints exist.' ),
        array( 'id' => '3.5', 'name' => 'Rate Limit Headers',        'level' => 3, 'category' => 'Optimized', 'description' => 'Responses include rate limit headers.' ),
        array( 'id' => '3.6', 'name' => 'Caching Headers',           'level' => 3, 'category' => 'Optimized', 'description' => 'Responses include ETag, Cache-Control, or Last-Modified.' ),
        array( 'id' => '3.7', 'name' => 'MCP Tool Quality',          'level' => 3, 'category' => 'Optimized', 'description' => 'MCP server exposes well-described tools with input schemas.' ),
    );

    /**
     * Calculate progress for each level.
     *
     * @param array $checks Array of check result arrays.
     * @return array Level progress data.
     */
    public static function calculate_level_progress( $checks ) {
        $progress = array();

        foreach ( self::LEVELS as $number => $level ) {
            $level_checks = array_filter( $checks, function( $c ) use ( $number ) {
                return (int) $c['level'] === $number;
            });

            $passed = count( array_filter( $level_checks, function( $c ) {
                return 'pass' === $c['status'];
            }));
            $na = count( array_filter( $level_checks, function( $c ) {
                return 'na' === $c['status'];
            }));
            $total      = count( $level_checks );
            $failed     = $total - $passed - $na;
            $applicable = $total - $na;

            $progress[ $number ] = array(
                'level'    => $level,
                'passed'   => $passed,
                'failed'   => $failed,
                'na'       => $na,
                'total'    => $total,
                'complete' => $applicable > 0 && $passed === $applicable,
            );
        }

        return $progress;
    }

    /**
     * Get the highest achieved level (0 if none).
     * Uses weighted cross-level scoring algorithm.
     *
     * @param array $level_progress From calculate_level_progress().
     * @return int 0-3.
     */
    public static function get_current_level( $level_progress ) {
        $rate = function( $lp ) {
            if ( ! $lp ) return 0;
            $applicable = $lp['total'] - $lp['na'];
            return $applicable > 0 ? $lp['passed'] / $applicable : 0;
        };

        $r1 = $rate( $level_progress[1] ?? null );
        $r2 = $rate( $level_progress[2] ?? null );
        $r3 = $rate( $level_progress[3] ?? null );

        $l2_achieved = ( $r1 >= 0.50 && $r2 >= 0.50 ) || ( $r1 >= 0.35 && $r2 >= 0.75 );
        $l3_achieved = ( $l2_achieved && $r3 >= 0.50 ) || ( $r2 >= 0.35 && $r3 >= 0.75 );

        if ( $l3_achieved ) return 3;
        if ( $l2_achieved ) return 2;
        if ( $r1 >= 0.50 )  return 1;

        return 0;
    }
}
```

- [ ] **Step 5: Commit foundation**

```bash
git add wordpress-plugin/
git commit -m "feat(wp): scaffold plugin with bootstrap, uninstall, and scoring class"
```

---

## Task 2: Scanner — L1 Checks (14 Checks)

**Files:**
- Create: `wordpress-plugin/botvisibility/includes/class-scanner.php`

- [ ] **Step 1: Create scanner class with L1 check methods**

Create `wordpress-plugin/botvisibility/includes/class-scanner.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class BotVisibility_Scanner {

    /**
     * Run all 30 checks and return results.
     *
     * @return array {
     *   checks: array of check results,
     *   levels: array of level progress,
     *   currentLevel: int,
     * }
     */
    public static function run_all_checks() {
        $checks = array();
        $options = get_option( 'botvisibility_options', array() );

        // L1 checks.
        $checks[] = self::check_llms_txt();
        $checks[] = self::check_agent_card();
        $checks[] = self::check_openapi_spec();
        $checks[] = self::check_robots_txt();
        $checks[] = self::check_docs_accessibility();
        $checks[] = self::check_cors_headers();
        $checks[] = self::check_ai_meta_tags();
        $checks[] = self::check_skill_file();
        $checks[] = self::check_ai_json();
        $checks[] = self::check_skills_index();
        $checks[] = self::check_link_headers();
        $checks[] = self::check_mcp_server();
        $checks[] = self::check_token_efficiency();
        $checks[] = self::check_rss_feed();

        // L2 checks.
        $checks[] = self::check_api_read_ops();
        $checks[] = self::check_api_write_ops();
        $checks[] = self::check_api_primary_action();
        $checks[] = self::check_api_key_auth();
        $checks[] = self::check_scoped_keys();
        $checks[] = self::check_openid_config();
        $checks[] = self::check_structured_errors();
        $checks[] = self::check_async_ops();
        $checks[] = self::check_idempotency();

        // L3 checks.
        $checks[] = self::check_sparse_fields();
        $checks[] = self::check_cursor_pagination();
        $checks[] = self::check_search_filtering();
        $checks[] = self::check_bulk_operations();
        $checks[] = self::check_rate_limit_headers();
        $checks[] = self::check_caching_headers();
        $checks[] = self::check_mcp_tool_quality();

        $levels        = BotVisibility_Scoring::calculate_level_progress( $checks );
        $current_level = BotVisibility_Scoring::get_current_level( $levels );

        $result = array(
            'url'          => home_url(),
            'timestamp'    => gmdate( 'c' ),
            'checks'       => $checks,
            'levels'       => $levels,
            'currentLevel' => $current_level,
        );

        set_transient( 'botvis_scan_results', $result, HOUR_IN_SECONDS );

        return $result;
    }

    /**
     * Scheduled scan callback.
     */
    public static function run_scheduled_scan() {
        $previous = get_transient( 'botvis_scan_results' );
        $result   = self::run_all_checks();

        if ( $previous && $previous['currentLevel'] !== $result['currentLevel'] ) {
            // Notify admin of level change.
            $admin_email = get_option( 'admin_email' );
            $subject     = sprintf( '[BotVisibility] Level changed: %d → %d', $previous['currentLevel'], $result['currentLevel'] );
            $message     = sprintf(
                "Your BotVisibility level changed from %d to %d.\n\nView details: %s",
                $previous['currentLevel'],
                $result['currentLevel'],
                admin_url( 'admin.php?page=botvisibility' )
            );
            wp_mail( $admin_email, $subject, $message );
        }
    }

    /**
     * Helper: build a check result array.
     */
    private static function result( $id, $name, $level, $category, $status, $message, $details = '', $recommendation = '', $found_at = '' ) {
        return array(
            'id'             => $id,
            'name'           => $name,
            'passed'         => 'pass' === $status,
            'status'         => $status,
            'level'          => $level,
            'category'       => $category,
            'autoDetectable' => true,
            'message'        => $message,
            'details'        => $details,
            'recommendation' => $recommendation,
            'foundAt'        => $found_at,
        );
    }

    /**
     * Helper: check if a file exists at the web root or is served via virtual route.
     */
    private static function file_exists_or_virtual( $relative_path ) {
        // Check physical file first.
        $abs_path = ABSPATH . ltrim( $relative_path, '/' );
        if ( file_exists( $abs_path ) ) {
            return array( 'exists' => true, 'type' => 'static', 'content' => file_get_contents( $abs_path ) );
        }

        // Check if virtual route is enabled.
        $options       = get_option( 'botvisibility_options', array() );
        $enabled_files = $options['enabled_files'] ?? array();
        $file_key_map  = array(
            'llms.txt'                          => 'llms-txt',
            '.well-known/agent-card.json'       => 'agent-card',
            '.well-known/ai.json'               => 'ai-json',
            '.well-known/skills/index.json'     => 'skills-index',
            'skill.md'                          => 'skill-md',
            'openapi.json'                      => 'openapi',
            '.well-known/mcp.json'              => 'mcp-json',
        );

        $key = $file_key_map[ ltrim( $relative_path, '/' ) ] ?? '';
        if ( $key && ! empty( $enabled_files[ $key ] ) ) {
            $content = BotVisibility_File_Generator::generate( $key );
            return array( 'exists' => true, 'type' => 'virtual', 'content' => $content );
        }

        return array( 'exists' => false, 'type' => 'none', 'content' => '' );
    }

    /**
     * Helper: make an HTTP request to own site.
     */
    private static function self_fetch( $path, $args = array() ) {
        $url = home_url( $path );
        $defaults = array(
            'timeout'    => 10,
            'user-agent' => 'BotVisibility/1.0 (self-scan)',
            'sslverify'  => false,
        );
        return wp_remote_get( $url, array_merge( $defaults, $args ) );
    }

    // ========================================
    // L1: DISCOVERABLE CHECKS
    // ========================================

    /**
     * 1.1 llms.txt
     */
    private static function check_llms_txt() {
        $paths = array( 'llms.txt', 'llms-full.txt', '.well-known/llms.txt' );

        foreach ( $paths as $path ) {
            $info = self::file_exists_or_virtual( $path );
            if ( $info['exists'] ) {
                $content = $info['content'];
                $len     = strlen( $content );

                if ( $len < 50 ) {
                    continue;
                }

                $has_markdown = strpos( $content, '#' ) !== false;
                $has_links    = strpos( $content, 'http' ) !== false;

                if ( $has_markdown || $has_links ) {
                    return self::result( '1.1', 'llms.txt', 1, 'Discoverable', 'pass',
                        'llms.txt exists with valid content',
                        sprintf( 'Found at /%s (%d chars, %s)', $path, $len, $info['type'] ),
                        '', home_url( '/' . $path )
                    );
                }

                return self::result( '1.1', 'llms.txt', 1, 'Discoverable', 'partial',
                    'llms.txt exists but could be improved',
                    sprintf( 'Found at /%s but missing markdown structure or links', $path ),
                    'Add app description, API links, and documentation references.'
                );
            }
        }

        return self::result( '1.1', 'llms.txt', 1, 'Discoverable', 'fail',
            'No llms.txt found',
            'Checked /llms.txt, /llms-full.txt, /.well-known/llms.txt',
            'Create an llms.txt file describing your site for AI agents. Use the Fix button to auto-generate one.'
        );
    }

    /**
     * 1.2 Agent Card
     */
    private static function check_agent_card() {
        $info = self::file_exists_or_virtual( '.well-known/agent-card.json' );

        if ( $info['exists'] ) {
            $data = json_decode( $info['content'], true );
            if ( is_array( $data ) && ! empty( $data['name'] ) && ! empty( $data['description'] ) && ! empty( $data['url'] ) ) {
                return self::result( '1.2', 'Agent Card', 1, 'Discoverable', 'pass',
                    'Agent card found with required fields',
                    sprintf( 'name: %s (%s)', $data['name'], $info['type'] ),
                    '', home_url( '/.well-known/agent-card.json' )
                );
            }

            return self::result( '1.2', 'Agent Card', 1, 'Discoverable', 'partial',
                'Agent card exists but missing required fields',
                'Must include: name, description, url',
                'Add missing fields to your agent-card.json.'
            );
        }

        return self::result( '1.2', 'Agent Card', 1, 'Discoverable', 'fail',
            'No agent card found',
            'Checked /.well-known/agent-card.json',
            'Use the Fix button to auto-generate an agent card from your site metadata.'
        );
    }

    /**
     * 1.3 OpenAPI Spec
     */
    private static function check_openapi_spec() {
        $paths = array( 'openapi.json', 'openapi.yaml', 'swagger.json', 'api-docs' );

        foreach ( $paths as $path ) {
            $info = self::file_exists_or_virtual( $path );
            if ( $info['exists'] ) {
                $data = json_decode( $info['content'], true );
                if ( is_array( $data ) && ( isset( $data['openapi'] ) || isset( $data['swagger'] ) || isset( $data['paths'] ) ) ) {
                    return self::result( '1.3', 'OpenAPI Spec', 1, 'Discoverable', 'pass',
                        'OpenAPI specification found',
                        sprintf( 'Found at /%s (%s)', $path, $info['type'] ),
                        '', home_url( '/' . $path )
                    );
                }
            }
        }

        return self::result( '1.3', 'OpenAPI Spec', 1, 'Discoverable', 'fail',
            'No OpenAPI specification found',
            'Checked /openapi.json, /openapi.yaml, /swagger.json, /api-docs',
            'Use the Fix button to auto-generate an OpenAPI spec from your WordPress REST API.'
        );
    }

    /**
     * 1.4 robots.txt AI Policy
     */
    private static function check_robots_txt() {
        $robots_path = ABSPATH . 'robots.txt';
        $content     = '';

        if ( file_exists( $robots_path ) ) {
            $content = file_get_contents( $robots_path );
        } else {
            // WordPress generates a virtual robots.txt.
            $response = self::self_fetch( '/robots.txt' );
            if ( ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response ) ) {
                $content = wp_remote_retrieve_body( $response );
            }
        }

        if ( empty( $content ) ) {
            return self::result( '1.4', 'robots.txt AI Policy', 1, 'Discoverable', 'fail',
                'No robots.txt found',
                '',
                'Create a robots.txt file with AI crawler directives.'
            );
        }

        $content_lower   = strtolower( $content );
        $ai_bots         = array( 'gptbot', 'claudebot', 'googlebot-extended', 'anthropic', 'openai' );
        $mentioned_bots  = array();

        foreach ( $ai_bots as $bot ) {
            if ( strpos( $content_lower, strtolower( $bot ) ) !== false ) {
                $mentioned_bots[] = $bot;
            }
        }

        if ( count( $mentioned_bots ) >= 2 ) {
            return self::result( '1.4', 'robots.txt AI Policy', 1, 'Discoverable', 'pass',
                'robots.txt has AI crawler directives',
                'Mentions: ' . implode( ', ', $mentioned_bots ),
                '', home_url( '/robots.txt' )
            );
        }

        if ( count( $mentioned_bots ) >= 1 ) {
            return self::result( '1.4', 'robots.txt AI Policy', 1, 'Discoverable', 'partial',
                'robots.txt exists but has limited AI crawler directives',
                'Only mentions: ' . implode( ', ', $mentioned_bots ),
                'Add directives for more AI crawlers (GPTBot, ClaudeBot, Anthropic, etc.).'
            );
        }

        return self::result( '1.4', 'robots.txt AI Policy', 1, 'Discoverable', 'partial',
            'robots.txt exists but has no AI-specific directives',
            'File exists but does not mention any AI crawlers',
            'Add User-agent directives for GPTBot, ClaudeBot, and other AI crawlers.'
        );
    }

    /**
     * 1.5 Documentation Accessibility
     */
    private static function check_docs_accessibility() {
        // Check for JSON-LD with potentialAction on homepage.
        $response = self::self_fetch( '/' );

        if ( is_wp_error( $response ) ) {
            return self::result( '1.5', 'Documentation Accessibility', 1, 'Discoverable', 'na',
                'Could not fetch homepage',
                '', ''
            );
        }

        $html = wp_remote_retrieve_body( $response );

        // Check for JSON-LD structured data.
        if ( preg_match( '/<script[^>]*type=["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/si', $html, $matches ) ) {
            $jsonld = json_decode( $matches[1], true );
            if ( is_array( $jsonld ) && isset( $jsonld['potentialAction'] ) ) {
                return self::result( '1.5', 'Documentation Accessibility', 1, 'Discoverable', 'pass',
                    'Structured data with potentialAction found',
                    'JSON-LD includes potentialAction for agent discovery'
                );
            }
        }

        // WordPress sites are inherently accessible (no auth walls on content).
        return self::result( '1.5', 'Documentation Accessibility', 1, 'Discoverable', 'partial',
            'Content is publicly accessible but lacks structured discovery metadata',
            'No JSON-LD potentialAction found',
            'Add JSON-LD structured data with potentialAction to your homepage.'
        );
    }

    /**
     * 1.6 CORS Headers
     */
    private static function check_cors_headers() {
        $response = self::self_fetch( '/wp-json/wp/v2/', array(
            'headers' => array( 'Origin' => 'https://example.com' ),
        ));

        if ( is_wp_error( $response ) ) {
            return self::result( '1.6', 'CORS Headers', 1, 'Discoverable', 'fail',
                'Could not check CORS headers',
                $response->get_error_message()
            );
        }

        $cors_header = wp_remote_retrieve_header( $response, 'access-control-allow-origin' );

        if ( ! empty( $cors_header ) ) {
            return self::result( '1.6', 'CORS Headers', 1, 'Discoverable', 'pass',
                'CORS headers present on REST API',
                sprintf( 'Access-Control-Allow-Origin: %s', $cors_header )
            );
        }

        return self::result( '1.6', 'CORS Headers', 1, 'Discoverable', 'fail',
            'No CORS headers on REST API responses',
            'Access-Control-Allow-Origin header not found',
            'Enable CORS in BotVisibility settings to allow cross-origin agent access.'
        );
    }

    /**
     * 1.7 AI Meta Tags
     */
    private static function check_ai_meta_tags() {
        $response = self::self_fetch( '/' );

        if ( is_wp_error( $response ) ) {
            return self::result( '1.7', 'AI Meta Tags', 1, 'Discoverable', 'fail',
                'Could not fetch homepage', ''
            );
        }

        $html  = wp_remote_retrieve_body( $response );
        $found = array();

        if ( preg_match( '/name=["\']llms:description["\']/', $html ) ) {
            $found[] = 'llms:description';
        }
        if ( preg_match( '/name=["\']llms:url["\']/', $html ) ) {
            $found[] = 'llms:url';
        }
        if ( preg_match( '/name=["\']llms:instructions["\']/', $html ) ) {
            $found[] = 'llms:instructions';
        }

        if ( count( $found ) >= 2 ) {
            return self::result( '1.7', 'AI Meta Tags', 1, 'Discoverable', 'pass',
                'AI meta tags found',
                'Found: ' . implode( ', ', $found )
            );
        }

        if ( count( $found ) >= 1 ) {
            return self::result( '1.7', 'AI Meta Tags', 1, 'Discoverable', 'partial',
                'Some AI meta tags found',
                'Found: ' . implode( ', ', $found ),
                'Add llms:description, llms:url, and llms:instructions meta tags.'
            );
        }

        return self::result( '1.7', 'AI Meta Tags', 1, 'Discoverable', 'fail',
            'No AI meta tags found',
            'Checked for llms:description, llms:url, llms:instructions',
            'Enable meta tags in BotVisibility settings to inject AI discovery tags.'
        );
    }

    /**
     * 1.8 Skill File
     */
    private static function check_skill_file() {
        $info = self::file_exists_or_virtual( 'skill.md' );

        if ( $info['exists'] ) {
            $content        = $info['content'];
            $has_frontmatter = strpos( $content, '---' ) === 0;

            if ( $has_frontmatter && strlen( $content ) > 100 ) {
                return self::result( '1.8', 'Skill File', 1, 'Discoverable', 'pass',
                    'Skill file found with YAML frontmatter',
                    sprintf( '%d chars (%s)', strlen( $content ), $info['type'] ),
                    '', home_url( '/skill.md' )
                );
            }

            return self::result( '1.8', 'Skill File', 1, 'Discoverable', 'partial',
                'Skill file exists but lacks YAML frontmatter or is too short',
                '',
                'Add YAML frontmatter (---) with name, description, and instructions.'
            );
        }

        return self::result( '1.8', 'Skill File', 1, 'Discoverable', 'fail',
            'No skill.md found',
            '',
            'Use the Fix button to auto-generate a skill file for your site.'
        );
    }

    /**
     * 1.9 AI Site Profile
     */
    private static function check_ai_json() {
        $info = self::file_exists_or_virtual( '.well-known/ai.json' );

        if ( $info['exists'] ) {
            $data = json_decode( $info['content'], true );
            if ( is_array( $data ) && ! empty( $data['name'] ) ) {
                return self::result( '1.9', 'AI Site Profile', 1, 'Discoverable', 'pass',
                    'AI site profile found',
                    sprintf( 'name: %s (%s)', $data['name'], $info['type'] ),
                    '', home_url( '/.well-known/ai.json' )
                );
            }

            return self::result( '1.9', 'AI Site Profile', 1, 'Discoverable', 'partial',
                'ai.json exists but missing required fields',
                'Must include at minimum: name',
                'Add site name and capabilities to ai.json.'
            );
        }

        return self::result( '1.9', 'AI Site Profile', 1, 'Discoverable', 'fail',
            'No ai.json found',
            'Checked /.well-known/ai.json',
            'Use the Fix button to auto-generate an AI site profile.'
        );
    }

    /**
     * 1.10 Skills Index
     */
    private static function check_skills_index() {
        $info = self::file_exists_or_virtual( '.well-known/skills/index.json' );

        if ( $info['exists'] ) {
            $data = json_decode( $info['content'], true );
            if ( is_array( $data ) && count( $data ) > 0 ) {
                return self::result( '1.10', 'Skills Index', 1, 'Discoverable', 'pass',
                    'Skills index found',
                    sprintf( '%d skills listed (%s)', count( $data ), $info['type'] ),
                    '', home_url( '/.well-known/skills/index.json' )
                );
            }
        }

        return self::result( '1.10', 'Skills Index', 1, 'Discoverable', 'fail',
            'No skills index found',
            'Checked /.well-known/skills/index.json',
            'Use the Fix button to generate a skills index.'
        );
    }

    /**
     * 1.11 Link Headers
     */
    private static function check_link_headers() {
        $response = self::self_fetch( '/' );

        if ( is_wp_error( $response ) ) {
            return self::result( '1.11', 'Link Headers', 1, 'Discoverable', 'fail',
                'Could not fetch homepage', ''
            );
        }

        $html  = wp_remote_retrieve_body( $response );
        $found = array();

        if ( preg_match( '/href=["\'][^"\']*llms\.txt["\']/', $html ) ) {
            $found[] = 'llms.txt';
        }
        if ( preg_match( '/href=["\'][^"\']*ai\.json["\']/', $html ) ) {
            $found[] = 'ai.json';
        }
        if ( preg_match( '/href=["\'][^"\']*agent-card\.json["\']/', $html ) ) {
            $found[] = 'agent-card.json';
        }

        if ( count( $found ) >= 1 ) {
            return self::result( '1.11', 'Link Headers', 1, 'Discoverable', 'pass',
                'Link elements found pointing to discovery files',
                'Found links to: ' . implode( ', ', $found )
            );
        }

        return self::result( '1.11', 'Link Headers', 1, 'Discoverable', 'fail',
            'No <link> elements pointing to discovery files',
            'Checked for links to llms.txt, ai.json, agent-card.json',
            'Enable link headers in BotVisibility settings.'
        );
    }

    /**
     * 1.12 MCP Server
     */
    private static function check_mcp_server() {
        $paths = array( '.well-known/mcp.json', 'mcp.json' );

        foreach ( $paths as $path ) {
            $info = self::file_exists_or_virtual( $path );
            if ( $info['exists'] ) {
                $data = json_decode( $info['content'], true );
                if ( is_array( $data ) ) {
                    return self::result( '1.12', 'MCP Server', 1, 'Discoverable', 'pass',
                        'MCP server manifest found',
                        sprintf( 'Found at /%s (%s)', $path, $info['type'] ),
                        '', home_url( '/' . $path )
                    );
                }
            }
        }

        return self::result( '1.12', 'MCP Server', 1, 'Discoverable', 'fail',
            'No MCP server manifest found',
            'Checked /.well-known/mcp.json, /mcp.json',
            'Use the Fix button to generate an MCP manifest from your REST API.'
        );
    }

    /**
     * 1.13 Page Token Efficiency
     */
    private static function check_token_efficiency() {
        $response = self::self_fetch( '/' );

        if ( is_wp_error( $response ) ) {
            return self::result( '1.13', 'Page Token Efficiency', 1, 'Discoverable', 'na',
                'Could not fetch homepage', ''
            );
        }

        $html = wp_remote_retrieve_body( $response );
        if ( empty( $html ) ) {
            return self::result( '1.13', 'Page Token Efficiency', 1, 'Discoverable', 'na',
                'Empty homepage response', ''
            );
        }

        // Rough token estimation: ~4 chars per token.
        $raw_tokens = (int) ceil( strlen( $html ) / 4 );

        // Strip scripts, styles, and HTML tags to get content.
        $clean = preg_replace( '/<script[^>]*>.*?<\/script>/si', '', $html );
        $clean = preg_replace( '/<style[^>]*>.*?<\/style>/si', '', $clean );
        $clean = wp_strip_all_tags( $clean );
        $clean = preg_replace( '/\s+/', ' ', trim( $clean ) );

        $clean_tokens = (int) ceil( strlen( $clean ) / 4 );
        $waste_ratio  = $raw_tokens > 0 ? round( ( 1 - $clean_tokens / $raw_tokens ) * 100 ) : 0;
        $multiplier   = $clean_tokens > 0 ? round( $raw_tokens / $clean_tokens, 1 ) : 0;

        $details = wp_json_encode( array(
            'rawTokens'   => $raw_tokens,
            'cleanTokens' => $clean_tokens,
            'wasteRatio'  => $waste_ratio,
            'multiplier'  => (string) $multiplier,
        ));

        if ( $multiplier <= 3 ) {
            $status  = 'pass';
            $message = 'Homepage is token-efficient';
        } elseif ( $multiplier <= 6 ) {
            $status  = 'partial';
            $message = 'Homepage has moderate token overhead';
        } else {
            $status  = 'fail';
            $message = 'Homepage has high token overhead';
        }

        return self::result( '1.13', 'Page Token Efficiency', 1, 'Discoverable', $status,
            $message,
            $details,
            'Reduce inline scripts, styles, and HTML boilerplate to improve token efficiency.'
        );
    }

    /**
     * 1.14 RSS/Atom Feed
     */
    private static function check_rss_feed() {
        // WordPress always has RSS feeds built-in.
        $feed_url = get_feed_link( 'rss2' );

        return self::result( '1.14', 'RSS/Atom Feed', 1, 'Discoverable', 'pass',
            'RSS feed available (WordPress built-in)',
            sprintf( 'Feed URL: %s', $feed_url ),
            '', $feed_url
        );
    }

    // ========================================
    // L2: USABLE CHECKS
    // ========================================

    /**
     * Helper: get or generate the OpenAPI spec for L2/L3 analysis.
     */
    private static function get_openapi_spec() {
        static $spec = null;
        if ( null !== $spec ) {
            return $spec;
        }

        // Check for custom uploaded spec first.
        $options = get_option( 'botvisibility_options', array() );
        $custom  = $options['custom_content']['openapi'] ?? '';
        if ( ! empty( $custom ) ) {
            $spec = json_decode( $custom, true );
            if ( is_array( $spec ) ) {
                return $spec;
            }
        }

        // Check if generated spec exists.
        $info = self::file_exists_or_virtual( 'openapi.json' );
        if ( $info['exists'] ) {
            $spec = json_decode( $info['content'], true );
            if ( is_array( $spec ) ) {
                return $spec;
            }
        }

        // Fall back to generating from WP REST API.
        $spec = BotVisibility_OpenAPI_Generator::generate();
        return $spec;
    }

    /**
     * Helper: parse spec for flags (port of parseOpenApiSpec from scanner.ts).
     */
    private static function parse_spec_flags( $spec ) {
        if ( ! is_array( $spec ) || empty( $spec['paths'] ) ) {
            return array(
                'hasGetEndpoints'    => false,
                'hasWriteEndpoints'  => false,
                'hasNonGetEndpoints' => false,
                'hasApiKeyAuth'      => false,
                'hasScopedAuth'      => false,
                'hasAsyncPatterns'   => false,
                'hasIdempotencyKey'  => false,
                'hasSparseFields'    => false,
                'hasCursorPagination'=> false,
                'hasSearchFiltering' => false,
                'hasBulkOperations'  => false,
            );
        }

        $flags = array(
            'hasGetEndpoints'    => false,
            'hasWriteEndpoints'  => false,
            'hasNonGetEndpoints' => false,
            'hasApiKeyAuth'      => false,
            'hasScopedAuth'      => false,
            'hasAsyncPatterns'   => false,
            'hasIdempotencyKey'  => false,
            'hasSparseFields'    => false,
            'hasCursorPagination'=> false,
            'hasSearchFiltering' => false,
            'hasBulkOperations'  => false,
        );

        $spec_str = strtolower( wp_json_encode( $spec ) );

        foreach ( $spec['paths'] as $path_key => $path_item ) {
            if ( ! is_array( $path_item ) ) continue;

            $path_lower = strtolower( $path_key );
            if ( strpos( $path_lower, 'bulk' ) !== false || strpos( $path_lower, 'batch' ) !== false ) {
                $flags['hasBulkOperations'] = true;
            }
            if ( strpos( $path_lower, 'search' ) !== false ) {
                $flags['hasSearchFiltering'] = true;
            }

            foreach ( $path_item as $method => $operation ) {
                $m = strtolower( $method );
                if ( 'get' === $m ) $flags['hasGetEndpoints'] = true;
                if ( in_array( $m, array( 'post', 'put', 'patch', 'delete' ), true ) ) {
                    $flags['hasWriteEndpoints']  = true;
                    $flags['hasNonGetEndpoints'] = true;
                }

                if ( is_array( $operation ) ) {
                    $op_str = strtolower( wp_json_encode( $operation ) );

                    if ( strpos( $op_str, 'callback' ) !== false || strpos( $op_str, 'webhook' ) !== false || strpos( $op_str, '"202"' ) !== false ) {
                        $flags['hasAsyncPatterns'] = true;
                    }
                    if ( strpos( $op_str, 'idempotency' ) !== false ) {
                        $flags['hasIdempotencyKey'] = true;
                    }
                    if ( strpos( $op_str, '"fields"' ) !== false || strpos( $op_str, '"_fields"' ) !== false ) {
                        $flags['hasSparseFields'] = true;
                    }
                    if ( strpos( $op_str, 'cursor' ) !== false || strpos( $op_str, 'page_token' ) !== false ) {
                        $flags['hasCursorPagination'] = true;
                    }
                    if ( strpos( $op_str, '"filter"' ) !== false || strpos( $op_str, '"search"' ) !== false || strpos( $op_str, '"q"' ) !== false ) {
                        $flags['hasSearchFiltering'] = true;
                    }
                    if ( strpos( $op_str, 'bulk' ) !== false || strpos( $op_str, 'batch' ) !== false ) {
                        $flags['hasBulkOperations'] = true;
                    }
                }
            }
        }

        // Security schemes.
        $components       = $spec['components'] ?? $spec['securityDefinitions'] ?? array();
        $security_schemes = $components['securitySchemes'] ?? $spec['securityDefinitions'] ?? array();

        if ( is_array( $security_schemes ) ) {
            foreach ( $security_schemes as $scheme ) {
                if ( ! is_array( $scheme ) ) continue;
                $type = $scheme['type'] ?? '';
                if ( in_array( $type, array( 'apiKey', 'http' ), true ) ) {
                    $flags['hasApiKeyAuth'] = true;
                }
                if ( in_array( $type, array( 'oauth2', 'openIdConnect' ), true ) ) {
                    $flags['hasScopedAuth'] = true;
                    $flags['hasApiKeyAuth'] = true;
                }
            }
        }

        return $flags;
    }

    /**
     * 2.1 API Read Operations
     */
    private static function check_api_read_ops() {
        $spec  = self::get_openapi_spec();
        $flags = self::parse_spec_flags( $spec );

        if ( $flags['hasGetEndpoints'] ) {
            return self::result( '2.1', 'API Read Operations', 2, 'Usable', 'pass',
                'GET endpoints available via REST API',
                'WordPress REST API provides read endpoints for posts, pages, categories, etc.'
            );
        }

        return self::result( '2.1', 'API Read Operations', 2, 'Usable', 'fail',
            'No GET endpoints found in API spec', ''
        );
    }

    /**
     * 2.2 API Write Operations
     */
    private static function check_api_write_ops() {
        $spec  = self::get_openapi_spec();
        $flags = self::parse_spec_flags( $spec );

        if ( $flags['hasWriteEndpoints'] ) {
            return self::result( '2.2', 'API Write Operations', 2, 'Usable', 'pass',
                'Write endpoints available via REST API',
                'WordPress REST API provides POST/PUT/DELETE for posts, pages, etc.'
            );
        }

        return self::result( '2.2', 'API Write Operations', 2, 'Usable', 'fail',
            'No write endpoints found in API spec', ''
        );
    }

    /**
     * 2.3 API Primary Action
     */
    private static function check_api_primary_action() {
        $spec  = self::get_openapi_spec();
        $flags = self::parse_spec_flags( $spec );

        if ( $flags['hasNonGetEndpoints'] ) {
            return self::result( '2.3', 'API Primary Action', 2, 'Usable', 'pass',
                'Primary site actions available via API',
                'Non-GET endpoints found — core value is API-accessible.'
            );
        }

        return self::result( '2.3', 'API Primary Action', 2, 'Usable', 'fail',
            'No non-GET endpoints found', '',
            'Ensure your primary site actions are available as API endpoints.'
        );
    }

    /**
     * 2.4 API Key Authentication
     */
    private static function check_api_key_auth() {
        // WordPress 5.6+ has Application Passwords built-in.
        if ( function_exists( 'wp_is_application_passwords_available' ) && wp_is_application_passwords_available() ) {
            return self::result( '2.4', 'API Key Authentication', 2, 'Usable', 'pass',
                'Application Passwords available (WordPress built-in)',
                'API key auth via Application Passwords since WP 5.6'
            );
        }

        $spec  = self::get_openapi_spec();
        $flags = self::parse_spec_flags( $spec );

        if ( $flags['hasApiKeyAuth'] ) {
            return self::result( '2.4', 'API Key Authentication', 2, 'Usable', 'pass',
                'API key authentication found in spec', ''
            );
        }

        return self::result( '2.4', 'API Key Authentication', 2, 'Usable', 'fail',
            'No API key authentication found', '',
            'Enable Application Passwords in WordPress or add API key auth.'
        );
    }

    /**
     * 2.5 Scoped API Keys
     */
    private static function check_scoped_keys() {
        $spec  = self::get_openapi_spec();
        $flags = self::parse_spec_flags( $spec );

        if ( $flags['hasScopedAuth'] ) {
            return self::result( '2.5', 'Scoped API Keys', 2, 'Usable', 'pass',
                'Scoped authentication available',
                'OAuth2 or OpenID scopes found in API spec.'
            );
        }

        // WordPress Application Passwords are user-scoped but not granularly scoped.
        if ( function_exists( 'wp_is_application_passwords_available' ) && wp_is_application_passwords_available() ) {
            return self::result( '2.5', 'Scoped API Keys', 2, 'Usable', 'partial',
                'Application Passwords are user-scoped but not granularly scoped',
                'WordPress Application Passwords grant full user capabilities',
                'Consider adding OAuth2 scopes for finer-grained access control.'
            );
        }

        return self::result( '2.5', 'Scoped API Keys', 2, 'Usable', 'fail',
            'No scoped authentication found', '',
            'Add OAuth2 or scoped API key support.'
        );
    }

    /**
     * 2.6 OpenID Configuration
     */
    private static function check_openid_config() {
        $info = self::file_exists_or_virtual( '.well-known/openid-configuration' );

        if ( $info['exists'] ) {
            $data = json_decode( $info['content'], true );
            if ( is_array( $data ) && ! empty( $data['issuer'] ) ) {
                return self::result( '2.6', 'OpenID Configuration', 2, 'Usable', 'pass',
                    'OpenID Connect discovery document found',
                    sprintf( 'Issuer: %s', $data['issuer'] ),
                    '', home_url( '/.well-known/openid-configuration' )
                );
            }
        }

        // Also check via HTTP in case another plugin serves it.
        $response = self::self_fetch( '/.well-known/openid-configuration' );
        if ( ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response ) ) {
            $data = json_decode( wp_remote_retrieve_body( $response ), true );
            if ( is_array( $data ) && ! empty( $data['issuer'] ) ) {
                return self::result( '2.6', 'OpenID Configuration', 2, 'Usable', 'pass',
                    'OpenID Connect discovery document found',
                    sprintf( 'Issuer: %s', $data['issuer'] )
                );
            }
        }

        return self::result( '2.6', 'OpenID Configuration', 2, 'Usable', 'fail',
            'No OpenID Connect discovery document found',
            'Checked /.well-known/openid-configuration',
            'Use the Fix button to generate an OIDC discovery document.'
        );
    }

    /**
     * 2.7 Structured Error Responses
     */
    private static function check_structured_errors() {
        $response = self::self_fetch( '/wp-json/wp/v2/this-should-not-exist-botvisibility-probe' );

        if ( is_wp_error( $response ) ) {
            return self::result( '2.7', 'Structured Error Responses', 2, 'Usable', 'na',
                'Could not probe API for error responses', ''
            );
        }

        $body = wp_remote_retrieve_body( $response );
        $data = json_decode( $body, true );

        if ( is_array( $data ) ) {
            $has_error_fields = isset( $data['code'] ) || isset( $data['message'] ) || isset( $data['error'] ) || isset( $data['status'] );

            if ( $has_error_fields ) {
                return self::result( '2.7', 'Structured Error Responses', 2, 'Usable', 'pass',
                    'API returns structured JSON error responses',
                    'WordPress REST API returns JSON with code, message, and data fields.'
                );
            }
        }

        return self::result( '2.7', 'Structured Error Responses', 2, 'Usable', 'fail',
            'API does not return structured error responses', '',
            'Ensure API errors return JSON with error code and message.'
        );
    }

    /**
     * 2.8 Async Operations
     */
    private static function check_async_ops() {
        $spec  = self::get_openapi_spec();
        $flags = self::parse_spec_flags( $spec );

        if ( $flags['hasAsyncPatterns'] ) {
            return self::result( '2.8', 'Async Operations', 2, 'Usable', 'pass',
                'Async operation patterns found',
                'Callbacks, webhooks, or 202 status codes in API spec.'
            );
        }

        return self::result( '2.8', 'Async Operations', 2, 'Usable', 'na',
            'No async operations detected',
            'WordPress REST API is synchronous by default — this is expected for most sites.',
            'Add webhook or callback support if your site has long-running operations.'
        );
    }

    /**
     * 2.9 Idempotency Support
     */
    private static function check_idempotency() {
        $options = get_option( 'botvisibility_options', array() );

        if ( ! empty( $options['enable_idempotency'] ) ) {
            return self::result( '2.9', 'Idempotency Support', 2, 'Usable', 'pass',
                'Idempotency-Key header support enabled',
                'BotVisibility REST Enhancer provides Idempotency-Key support.'
            );
        }

        $spec  = self::get_openapi_spec();
        $flags = self::parse_spec_flags( $spec );

        if ( $flags['hasIdempotencyKey'] ) {
            return self::result( '2.9', 'Idempotency Support', 2, 'Usable', 'pass',
                'Idempotency key support found in API spec', ''
            );
        }

        return self::result( '2.9', 'Idempotency Support', 2, 'Usable', 'fail',
            'No idempotency key support found', '',
            'Enable idempotency support in BotVisibility settings.'
        );
    }

    // ========================================
    // L3: OPTIMIZED CHECKS
    // ========================================

    /**
     * 3.1 Sparse Fields
     */
    private static function check_sparse_fields() {
        // WordPress REST API supports ?_fields= natively.
        $response = self::self_fetch( '/wp-json/wp/v2/posts?_fields=id,title&per_page=1' );

        if ( ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response ) ) {
            $data = json_decode( wp_remote_retrieve_body( $response ), true );
            if ( is_array( $data ) && count( $data ) > 0 ) {
                $first = $data[0];
                // If _fields works, response should have limited keys.
                if ( count( array_keys( $first ) ) <= 5 ) {
                    return self::result( '3.1', 'Sparse Fields', 3, 'Optimized', 'pass',
                        'Sparse field selection supported',
                        'WordPress REST API supports ?_fields= parameter natively.'
                    );
                }
            }
        }

        $spec  = self::get_openapi_spec();
        $flags = self::parse_spec_flags( $spec );

        if ( $flags['hasSparseFields'] ) {
            return self::result( '3.1', 'Sparse Fields', 3, 'Optimized', 'pass',
                'Sparse field selection found in API spec', ''
            );
        }

        return self::result( '3.1', 'Sparse Fields', 3, 'Optimized', 'fail',
            'No sparse field selection support found', '',
            'WordPress REST API should support ?_fields= by default.'
        );
    }

    /**
     * 3.2 Cursor Pagination
     */
    private static function check_cursor_pagination() {
        // WordPress uses offset/page pagination, not cursor-based.
        $spec  = self::get_openapi_spec();
        $flags = self::parse_spec_flags( $spec );

        if ( $flags['hasCursorPagination'] ) {
            return self::result( '3.2', 'Cursor Pagination', 3, 'Optimized', 'pass',
                'Cursor-based pagination found', ''
            );
        }

        // WordPress has ?page= which is offset-based.
        return self::result( '3.2', 'Cursor Pagination', 3, 'Optimized', 'partial',
            'WordPress uses page-based pagination (not cursor-based)',
            'REST API supports ?page= and ?per_page= but not cursor tokens.',
            'Consider adding cursor-based pagination for large datasets.'
        );
    }

    /**
     * 3.3 Search & Filtering
     */
    private static function check_search_filtering() {
        // WordPress REST API supports ?search= natively.
        $spec  = self::get_openapi_spec();
        $flags = self::parse_spec_flags( $spec );

        if ( $flags['hasSearchFiltering'] ) {
            return self::result( '3.3', 'Search & Filtering', 3, 'Optimized', 'pass',
                'Search and filtering supported',
                'WordPress REST API supports ?search=, ?categories=, ?tags=, etc.'
            );
        }

        return self::result( '3.3', 'Search & Filtering', 3, 'Optimized', 'pass',
            'Search and filtering supported',
            'WordPress REST API supports ?search= parameter natively.'
        );
    }

    /**
     * 3.4 Bulk Operations
     */
    private static function check_bulk_operations() {
        // WordPress 5.6+ has /batch/v1 endpoint.
        $response = self::self_fetch( '/wp-json/batch/v1' );

        if ( ! is_wp_error( $response ) ) {
            $code = wp_remote_retrieve_response_code( $response );
            // 404 means the endpoint exists but needs POST; that's fine.
            // 405 Method Not Allowed also means it exists.
            if ( in_array( $code, array( 200, 400, 405 ), true ) ) {
                return self::result( '3.4', 'Bulk Operations', 3, 'Optimized', 'pass',
                    'Batch API endpoint available',
                    'WordPress /batch/v1 endpoint supports bulk operations.'
                );
            }
        }

        $spec  = self::get_openapi_spec();
        $flags = self::parse_spec_flags( $spec );

        if ( $flags['hasBulkOperations'] ) {
            return self::result( '3.4', 'Bulk Operations', 3, 'Optimized', 'pass',
                'Bulk operations found in API spec', ''
            );
        }

        return self::result( '3.4', 'Bulk Operations', 3, 'Optimized', 'fail',
            'No bulk operation endpoints found', '',
            'WordPress 5.6+ includes /batch/v1 — ensure it is not disabled.'
        );
    }

    /**
     * 3.5 Rate Limit Headers
     */
    private static function check_rate_limit_headers() {
        $response = self::self_fetch( '/wp-json/wp/v2/posts?per_page=1' );

        if ( is_wp_error( $response ) ) {
            return self::result( '3.5', 'Rate Limit Headers', 3, 'Optimized', 'fail',
                'Could not check rate limit headers', ''
            );
        }

        $headers = wp_remote_retrieve_headers( $response );
        $found   = array();

        $rate_headers = array( 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after' );
        foreach ( $rate_headers as $h ) {
            if ( isset( $headers[ $h ] ) ) {
                $found[] = $h;
            }
        }

        if ( count( $found ) >= 2 ) {
            return self::result( '3.5', 'Rate Limit Headers', 3, 'Optimized', 'pass',
                'Rate limit headers present',
                'Found: ' . implode( ', ', $found )
            );
        }

        if ( count( $found ) >= 1 ) {
            return self::result( '3.5', 'Rate Limit Headers', 3, 'Optimized', 'partial',
                'Some rate limit headers present',
                'Found: ' . implode( ', ', $found ),
                'Add X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers.'
            );
        }

        return self::result( '3.5', 'Rate Limit Headers', 3, 'Optimized', 'fail',
            'No rate limit headers found', '',
            'Enable rate limit headers in BotVisibility settings.'
        );
    }

    /**
     * 3.6 Caching Headers
     */
    private static function check_caching_headers() {
        $response = self::self_fetch( '/wp-json/wp/v2/posts?per_page=1' );

        if ( is_wp_error( $response ) ) {
            return self::result( '3.6', 'Caching Headers', 3, 'Optimized', 'fail',
                'Could not check caching headers', ''
            );
        }

        $headers = wp_remote_retrieve_headers( $response );
        $found   = array();

        if ( isset( $headers['etag'] ) )           $found[] = 'ETag';
        if ( isset( $headers['cache-control'] ) )   $found[] = 'Cache-Control';
        if ( isset( $headers['last-modified'] ) )   $found[] = 'Last-Modified';

        if ( count( $found ) >= 1 ) {
            return self::result( '3.6', 'Caching Headers', 3, 'Optimized', 'pass',
                'Caching headers present',
                'Found: ' . implode( ', ', $found )
            );
        }

        return self::result( '3.6', 'Caching Headers', 3, 'Optimized', 'fail',
            'No caching headers on REST API responses', '',
            'Enable caching headers in BotVisibility settings.'
        );
    }

    /**
     * 3.7 MCP Tool Quality
     */
    private static function check_mcp_tool_quality() {
        $paths = array( '.well-known/mcp.json', 'mcp.json' );

        foreach ( $paths as $path ) {
            $info = self::file_exists_or_virtual( $path );
            if ( $info['exists'] ) {
                $data = json_decode( $info['content'], true );
                if ( is_array( $data ) && ! empty( $data['tools'] ) ) {
                    $tools    = $data['tools'];
                    $has_schemas = false;
                    foreach ( $tools as $tool ) {
                        if ( ! empty( $tool['inputSchema'] ) || ! empty( $tool['input_schema'] ) ) {
                            $has_schemas = true;
                            break;
                        }
                    }

                    if ( $has_schemas ) {
                        return self::result( '3.7', 'MCP Tool Quality', 3, 'Optimized', 'pass',
                            'MCP tools have input schemas',
                            sprintf( '%d tools with schemas defined', count( $tools ) )
                        );
                    }

                    return self::result( '3.7', 'MCP Tool Quality', 3, 'Optimized', 'partial',
                        'MCP tools found but missing input schemas',
                        sprintf( '%d tools but no input schemas', count( $tools ) ),
                        'Add inputSchema to each MCP tool definition.'
                    );
                }
            }
        }

        return self::result( '3.7', 'MCP Tool Quality', 3, 'Optimized', 'na',
            'No MCP server to evaluate',
            'MCP tool quality check requires an MCP manifest.',
            'Generate an MCP manifest first, then this check will evaluate tool quality.'
        );
    }
}
```

- [ ] **Step 2: Commit scanner**

```bash
git add wordpress-plugin/botvisibility/includes/class-scanner.php
git commit -m "feat(wp): add scanner with all 30 L1-L3 checks"
```

---

## Task 3: File Generator & Templates

**Files:**
- Create: `wordpress-plugin/botvisibility/includes/class-file-generator.php`
- Create: `wordpress-plugin/botvisibility/templates/llms-txt.php`
- Create: `wordpress-plugin/botvisibility/templates/agent-card.php`
- Create: `wordpress-plugin/botvisibility/templates/ai-json.php`
- Create: `wordpress-plugin/botvisibility/templates/skill-md.php`
- Create: `wordpress-plugin/botvisibility/templates/skills-index.php`
- Create: `wordpress-plugin/botvisibility/templates/mcp-json.php`
- Create: `wordpress-plugin/botvisibility/templates/openid-configuration.php`

- [ ] **Step 1: Create file generator class**

Create `wordpress-plugin/botvisibility/includes/class-file-generator.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class BotVisibility_File_Generator {

    /**
     * Generate content for a given file key.
     *
     * @param string $key File key (llms-txt, agent-card, ai-json, etc.).
     * @return string Generated content.
     */
    public static function generate( $key ) {
        $options = get_option( 'botvisibility_options', array() );

        // Check for custom user content first.
        $custom = $options['custom_content'][ $key ] ?? '';
        if ( ! empty( $custom ) ) {
            return $custom;
        }

        $method = 'generate_' . str_replace( '-', '_', $key );
        if ( method_exists( __CLASS__, $method ) ) {
            return self::$method( $options );
        }

        return '';
    }

    /**
     * Generate llms.txt content.
     */
    private static function generate_llms_txt( $options ) {
        ob_start();
        include BOTVIS_PLUGIN_DIR . 'templates/llms-txt.php';
        return ob_get_clean();
    }

    /**
     * Generate agent-card.json content.
     */
    private static function generate_agent_card( $options ) {
        ob_start();
        include BOTVIS_PLUGIN_DIR . 'templates/agent-card.php';
        return ob_get_clean();
    }

    /**
     * Generate ai.json content.
     */
    private static function generate_ai_json( $options ) {
        ob_start();
        include BOTVIS_PLUGIN_DIR . 'templates/ai-json.php';
        return ob_get_clean();
    }

    /**
     * Generate skill.md content.
     */
    private static function generate_skill_md( $options ) {
        ob_start();
        include BOTVIS_PLUGIN_DIR . 'templates/skill-md.php';
        return ob_get_clean();
    }

    /**
     * Generate skills/index.json content.
     */
    private static function generate_skills_index( $options ) {
        ob_start();
        include BOTVIS_PLUGIN_DIR . 'templates/skills-index.php';
        return ob_get_clean();
    }

    /**
     * Generate mcp.json content.
     */
    private static function generate_mcp_json( $options ) {
        ob_start();
        include BOTVIS_PLUGIN_DIR . 'templates/mcp-json.php';
        return ob_get_clean();
    }

    /**
     * Generate openid-configuration content.
     */
    private static function generate_openid_configuration( $options ) {
        ob_start();
        include BOTVIS_PLUGIN_DIR . 'templates/openid-configuration.php';
        return ob_get_clean();
    }

    /**
     * Export a file to a static location.
     *
     * @param string $key File key.
     * @return bool|WP_Error True on success, WP_Error on failure.
     */
    public static function export_static( $key ) {
        $content = self::generate( $key );
        if ( empty( $content ) ) {
            return new WP_Error( 'empty_content', 'No content generated.' );
        }

        $path_map = array(
            'llms-txt'       => 'llms.txt',
            'agent-card'     => '.well-known/agent-card.json',
            'ai-json'        => '.well-known/ai.json',
            'skills-index'   => '.well-known/skills/index.json',
            'skill-md'       => 'skill.md',
            'openapi'        => 'openapi.json',
            'mcp-json'       => '.well-known/mcp.json',
            'openid-config'  => '.well-known/openid-configuration',
        );

        $relative = $path_map[ $key ] ?? '';
        if ( empty( $relative ) ) {
            return new WP_Error( 'unknown_key', 'Unknown file key.' );
        }

        $options   = get_option( 'botvisibility_options', array() );
        $base_path = $options['static_export_path'] ?? ABSPATH;
        $full_path = $base_path . $relative;
        $dir       = dirname( $full_path );

        if ( ! is_dir( $dir ) ) {
            if ( ! wp_mkdir_p( $dir ) ) {
                return new WP_Error( 'mkdir_failed', sprintf( 'Cannot create directory: %s', $dir ) );
            }
        }

        if ( false === file_put_contents( $full_path, $content ) ) {
            return new WP_Error( 'write_failed', sprintf( 'Cannot write to: %s', $full_path ) );
        }

        return true;
    }

    /**
     * Remove all static exported files.
     */
    public static function remove_static_files() {
        $options   = get_option( 'botvisibility_options', array() );
        $base_path = $options['static_export_path'] ?? ABSPATH;

        $files = array(
            'llms.txt',
            'skill.md',
            'openapi.json',
            '.well-known/agent-card.json',
            '.well-known/ai.json',
            '.well-known/skills/index.json',
            '.well-known/mcp.json',
            '.well-known/openid-configuration',
        );

        foreach ( $files as $file ) {
            $path = $base_path . $file;
            if ( file_exists( $path ) ) {
                unlink( $path );
            }
        }
    }
}
```

- [ ] **Step 2: Create template files**

Create `wordpress-plugin/botvisibility/templates/llms-txt.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$site_name   = get_bloginfo( 'name' );
$description = $options['site_description'] ?? get_bloginfo( 'description' );
$url         = home_url();
$api_url     = rest_url();

$pages = get_pages( array( 'number' => 20, 'sort_column' => 'menu_order' ) );
?>
# <?php echo esc_html( $site_name ); ?>

> <?php echo esc_html( $description ); ?>

## About

<?php echo esc_html( $site_name ); ?> is a WordPress-powered website.

- Website: <?php echo esc_url( $url ); ?>

- API: <?php echo esc_url( $api_url ); ?>

- OpenAPI Spec: <?php echo esc_url( home_url( '/openapi.json' ) ); ?>


## Key Pages

<?php foreach ( $pages as $page ) : ?>
- [<?php echo esc_html( $page->post_title ); ?>](<?php echo esc_url( get_permalink( $page ) ); ?>)
<?php endforeach; ?>

## API

The WordPress REST API provides programmatic access to site content.

- Posts: <?php echo esc_url( rest_url( 'wp/v2/posts' ) ); ?>

- Pages: <?php echo esc_url( rest_url( 'wp/v2/pages' ) ); ?>

- Categories: <?php echo esc_url( rest_url( 'wp/v2/categories' ) ); ?>

- Tags: <?php echo esc_url( rest_url( 'wp/v2/tags' ) ); ?>

- Media: <?php echo esc_url( rest_url( 'wp/v2/media' ) ); ?>

Authentication: Application Passwords (see WordPress documentation)
<?php
```

Create `wordpress-plugin/botvisibility/templates/agent-card.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$site_name    = get_bloginfo( 'name' );
$description  = $options['site_description'] ?? get_bloginfo( 'description' );
$url          = home_url();
$capabilities = $options['capabilities'] ?? array( 'content' );

$card = array(
    'name'         => $site_name,
    'description'  => $description,
    'url'          => $url,
    'api'          => array(
        'type'    => 'rest',
        'url'     => rest_url(),
        'spec'    => home_url( '/openapi.json' ),
        'auth'    => array( 'application_passwords' ),
    ),
    'capabilities' => $capabilities,
    'contact'      => array(
        'url' => $url,
    ),
    'discovery'    => array(
        'llms_txt'    => home_url( '/llms.txt' ),
        'ai_json'     => home_url( '/.well-known/ai.json' ),
        'skill_md'    => home_url( '/skill.md' ),
        'openapi'     => home_url( '/openapi.json' ),
    ),
);

echo wp_json_encode( $card, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
```

Create `wordpress-plugin/botvisibility/templates/ai-json.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$site_name    = get_bloginfo( 'name' );
$description  = $options['site_description'] ?? get_bloginfo( 'description' );
$capabilities = $options['capabilities'] ?? array( 'content' );

$ai = array(
    'name'         => $site_name,
    'description'  => $description,
    'url'          => home_url(),
    'capabilities' => $capabilities,
    'skills'       => array(
        home_url( '/.well-known/skills/index.json' ),
    ),
    'api'          => array(
        'spec' => home_url( '/openapi.json' ),
    ),
);

echo wp_json_encode( $ai, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
```

Create `wordpress-plugin/botvisibility/templates/skill-md.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$site_name   = get_bloginfo( 'name' );
$description = $options['site_description'] ?? get_bloginfo( 'description' );
$url         = home_url();
$api_url     = rest_url();
?>
---
name: <?php echo esc_html( $site_name ); ?>

description: <?php echo esc_html( $description ); ?>

url: <?php echo esc_url( $url ); ?>

api: <?php echo esc_url( $api_url ); ?>

---

# <?php echo esc_html( $site_name ); ?>


## Overview

<?php echo esc_html( $description ); ?>


## Getting Started

1. Explore the API at <?php echo esc_url( $api_url ); ?>

2. View available endpoints: GET <?php echo esc_url( rest_url( 'wp/v2' ) ); ?>

3. Authenticate with Application Passwords for write operations


## Reading Content

- List posts: GET <?php echo esc_url( rest_url( 'wp/v2/posts' ) ); ?>

- Get a post: GET <?php echo esc_url( rest_url( 'wp/v2/posts/{id}' ) ); ?>

- Search: GET <?php echo esc_url( rest_url( 'wp/v2/posts?search={query}' ) ); ?>

- Filter fields: add ?_fields=id,title,content to any request

## Writing Content

Requires authentication via Application Passwords.

- Create post: POST <?php echo esc_url( rest_url( 'wp/v2/posts' ) ); ?>

- Update post: PUT <?php echo esc_url( rest_url( 'wp/v2/posts/{id}' ) ); ?>

- Delete post: DELETE <?php echo esc_url( rest_url( 'wp/v2/posts/{id}' ) ); ?>

<?php
```

Create `wordpress-plugin/botvisibility/templates/skills-index.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$site_name = get_bloginfo( 'name' );
$url       = home_url();

$skills = array(
    array(
        'id'          => 'read-content',
        'name'        => 'Read Content',
        'description' => sprintf( 'Read posts, pages, and media from %s via REST API.', $site_name ),
        'url'         => rest_url( 'wp/v2/posts' ),
    ),
    array(
        'id'          => 'search-content',
        'name'        => 'Search Content',
        'description' => sprintf( 'Search %s content by keyword.', $site_name ),
        'url'         => rest_url( 'wp/v2/posts?search={query}' ),
    ),
    array(
        'id'          => 'manage-content',
        'name'        => 'Manage Content',
        'description' => 'Create, update, and delete posts and pages (requires authentication).',
        'url'         => rest_url( 'wp/v2/posts' ),
        'auth'        => 'application_passwords',
    ),
);

echo wp_json_encode( $skills, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
```

Create `wordpress-plugin/botvisibility/templates/mcp-json.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$site_name = get_bloginfo( 'name' );
$url       = home_url();

$mcp = array(
    'name'        => $site_name,
    'description' => $options['site_description'] ?? get_bloginfo( 'description' ),
    'version'     => '1.0.0',
    'tools'       => array(
        array(
            'name'        => 'list_posts',
            'description' => 'List published posts with optional search and filtering.',
            'inputSchema' => array(
                'type'       => 'object',
                'properties' => array(
                    'search'   => array( 'type' => 'string', 'description' => 'Search keyword' ),
                    'per_page' => array( 'type' => 'integer', 'description' => 'Results per page (1-100)', 'default' => 10 ),
                    'page'     => array( 'type' => 'integer', 'description' => 'Page number', 'default' => 1 ),
                    '_fields'  => array( 'type' => 'string', 'description' => 'Comma-separated field names to return' ),
                ),
            ),
            'endpoint'    => rest_url( 'wp/v2/posts' ),
            'method'      => 'GET',
        ),
        array(
            'name'        => 'get_post',
            'description' => 'Get a single post by ID.',
            'inputSchema' => array(
                'type'       => 'object',
                'properties' => array(
                    'id'      => array( 'type' => 'integer', 'description' => 'Post ID' ),
                    '_fields' => array( 'type' => 'string', 'description' => 'Comma-separated field names to return' ),
                ),
                'required'   => array( 'id' ),
            ),
            'endpoint'    => rest_url( 'wp/v2/posts/{id}' ),
            'method'      => 'GET',
        ),
        array(
            'name'        => 'list_pages',
            'description' => 'List published pages.',
            'inputSchema' => array(
                'type'       => 'object',
                'properties' => array(
                    'per_page' => array( 'type' => 'integer', 'description' => 'Results per page', 'default' => 10 ),
                    '_fields'  => array( 'type' => 'string', 'description' => 'Comma-separated field names' ),
                ),
            ),
            'endpoint'    => rest_url( 'wp/v2/pages' ),
            'method'      => 'GET',
        ),
        array(
            'name'        => 'search',
            'description' => 'Search across all content types.',
            'inputSchema' => array(
                'type'       => 'object',
                'properties' => array(
                    'search'  => array( 'type' => 'string', 'description' => 'Search query' ),
                    'type'    => array( 'type' => 'string', 'description' => 'Content type', 'enum' => array( 'post', 'page' ) ),
                ),
                'required'   => array( 'search' ),
            ),
            'endpoint'    => rest_url( 'wp/v2/search' ),
            'method'      => 'GET',
        ),
    ),
);

echo wp_json_encode( $mcp, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
```

Create `wordpress-plugin/botvisibility/templates/openid-configuration.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$url = home_url();

$oidc = array(
    'issuer'                 => $url,
    'authorization_endpoint' => wp_login_url(),
    'token_endpoint'         => rest_url( 'botvisibility/v1/token' ),
    'userinfo_endpoint'      => rest_url( 'wp/v2/users/me' ),
    'jwks_uri'               => home_url( '/.well-known/jwks.json' ),
    'response_types_supported' => array( 'code' ),
    'subject_types_supported'  => array( 'public' ),
    'scopes_supported'         => array( 'read', 'write', 'profile' ),
);

echo wp_json_encode( $oidc, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
```

- [ ] **Step 3: Commit file generator and templates**

```bash
git add wordpress-plugin/botvisibility/includes/class-file-generator.php wordpress-plugin/botvisibility/templates/
git commit -m "feat(wp): add file generator and content templates"
```

---

## Task 4: OpenAPI Generator

**Files:**
- Create: `wordpress-plugin/botvisibility/includes/class-openapi-generator.php`

- [ ] **Step 1: Create OpenAPI generator class**

Create `wordpress-plugin/botvisibility/includes/class-openapi-generator.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class BotVisibility_OpenAPI_Generator {

    /**
     * Generate OpenAPI 3.0 spec from WordPress REST API routes.
     *
     * @return array OpenAPI spec as associative array.
     */
    public static function generate() {
        $site_name   = get_bloginfo( 'name' );
        $description = get_bloginfo( 'description' );
        $options     = get_option( 'botvisibility_options', array() );

        $spec = array(
            'openapi' => '3.0.3',
            'info'    => array(
                'title'       => sprintf( '%s API', $site_name ),
                'description' => $description ?: sprintf( 'REST API for %s', $site_name ),
                'version'     => '1.0.0',
                'contact'     => array(
                    'url' => home_url(),
                ),
            ),
            'servers' => array(
                array( 'url' => rest_url() ),
            ),
            'paths'      => array(),
            'components' => array(
                'securitySchemes' => array(
                    'application_password' => array(
                        'type'   => 'http',
                        'scheme' => 'basic',
                        'description' => 'WordPress Application Passwords (username:app-password as Basic auth).',
                    ),
                ),
            ),
        );

        // Get registered REST routes.
        $server = rest_get_server();
        $routes = $server->get_routes();

        foreach ( $routes as $route => $handlers ) {
            // Skip internal/index routes.
            if ( '/' === $route || empty( $handlers ) ) {
                continue;
            }

            // Convert WP route pattern to OpenAPI path: (?P<id>[\d]+) → {id}
            $openapi_path = preg_replace( '/\(\?P<([^>]+)>[^)]+\)/', '{$1}', $route );

            // Skip regex-heavy routes that don't convert cleanly.
            if ( preg_match( '/[()\\\\]/', $openapi_path ) ) {
                continue;
            }

            $path_item = array();

            foreach ( $handlers as $handler ) {
                if ( ! is_array( $handler ) || empty( $handler['methods'] ) ) {
                    continue;
                }

                $methods = array_keys( $handler['methods'] );
                $args    = $handler['args'] ?? array();

                foreach ( $methods as $method ) {
                    $method_lower = strtolower( $method );
                    if ( ! in_array( $method_lower, array( 'get', 'post', 'put', 'patch', 'delete' ), true ) ) {
                        continue;
                    }

                    $operation = array(
                        'summary'   => self::generate_summary( $route, $method_lower ),
                        'responses' => array(
                            '200' => array( 'description' => 'Successful response' ),
                            '400' => array( 'description' => 'Bad request' ),
                            '401' => array( 'description' => 'Unauthorized' ),
                            '404' => array( 'description' => 'Not found' ),
                        ),
                    );

                    // Add parameters from args.
                    $parameters = self::args_to_parameters( $args, $method_lower, $openapi_path );
                    if ( ! empty( $parameters['parameters'] ) ) {
                        $operation['parameters'] = $parameters['parameters'];
                    }
                    if ( ! empty( $parameters['requestBody'] ) ) {
                        $operation['requestBody'] = $parameters['requestBody'];
                    }

                    // Write methods need auth.
                    if ( in_array( $method_lower, array( 'post', 'put', 'patch', 'delete' ), true ) ) {
                        $operation['security'] = array(
                            array( 'application_password' => array() ),
                        );
                    }

                    $path_item[ $method_lower ] = $operation;
                }
            }

            if ( ! empty( $path_item ) ) {
                $spec['paths'][ $openapi_path ] = $path_item;
            }
        }

        /**
         * Filter the generated OpenAPI spec.
         *
         * @param array $spec The OpenAPI specification.
         */
        $spec = apply_filters( 'botvisibility_openapi_spec', $spec );

        return $spec;
    }

    /**
     * Generate a human-readable summary from route and method.
     */
    private static function generate_summary( $route, $method ) {
        // Extract resource name from route.
        $parts    = explode( '/', trim( $route, '/' ) );
        $resource = end( $parts );

        // Clean up regex patterns.
        $resource = preg_replace( '/\(\?P<[^>]+>[^)]+\)/', '', $resource );
        $resource = trim( $resource, '/' );

        if ( empty( $resource ) ) {
            $resource = count( $parts ) > 1 ? $parts[ count( $parts ) - 2 ] : 'resource';
        }

        $has_id = preg_match( '/\{[^}]+\}/', preg_replace( '/\(\?P<([^>]+)>[^)]+\)/', '{$1}', $route ) );

        $verbs = array(
            'get'    => $has_id ? 'Get' : 'List',
            'post'   => 'Create',
            'put'    => 'Update',
            'patch'  => 'Update',
            'delete' => 'Delete',
        );

        return sprintf( '%s %s', $verbs[ $method ] ?? ucfirst( $method ), $resource );
    }

    /**
     * Convert WordPress REST API args to OpenAPI parameters.
     */
    private static function args_to_parameters( $args, $method, $openapi_path ) {
        $parameters  = array();
        $body_props  = array();
        $required    = array();

        // Extract path parameters.
        preg_match_all( '/\{([^}]+)\}/', $openapi_path, $path_params );
        $path_param_names = $path_params[1] ?? array();

        foreach ( $args as $name => $config ) {
            if ( ! is_array( $config ) ) {
                continue;
            }

            $type_map = array(
                'integer' => 'integer',
                'number'  => 'number',
                'string'  => 'string',
                'boolean' => 'boolean',
                'array'   => 'array',
                'object'  => 'object',
            );

            $param_type = $type_map[ $config['type'] ?? 'string' ] ?? 'string';

            if ( in_array( $name, $path_param_names, true ) ) {
                $param = array(
                    'name'     => $name,
                    'in'       => 'path',
                    'required' => true,
                    'schema'   => array( 'type' => $param_type ),
                );
                if ( ! empty( $config['description'] ) ) {
                    $param['description'] = $config['description'];
                }
                $parameters[] = $param;
            } elseif ( 'get' === $method ) {
                $param = array(
                    'name'   => $name,
                    'in'     => 'query',
                    'schema' => array( 'type' => $param_type ),
                );
                if ( ! empty( $config['description'] ) ) {
                    $param['description'] = $config['description'];
                }
                if ( ! empty( $config['required'] ) ) {
                    $param['required'] = true;
                }
                if ( isset( $config['default'] ) ) {
                    $param['schema']['default'] = $config['default'];
                }
                if ( ! empty( $config['enum'] ) ) {
                    $param['schema']['enum'] = $config['enum'];
                }
                $parameters[] = $param;
            } else {
                // Body parameter for write methods.
                $prop = array( 'type' => $param_type );
                if ( ! empty( $config['description'] ) ) {
                    $prop['description'] = $config['description'];
                }
                if ( isset( $config['default'] ) ) {
                    $prop['default'] = $config['default'];
                }
                if ( ! empty( $config['enum'] ) ) {
                    $prop['enum'] = $config['enum'];
                }
                $body_props[ $name ] = $prop;

                if ( ! empty( $config['required'] ) ) {
                    $required[] = $name;
                }
            }
        }

        $result = array( 'parameters' => $parameters );

        if ( ! empty( $body_props ) ) {
            $schema = array(
                'type'       => 'object',
                'properties' => $body_props,
            );
            if ( ! empty( $required ) ) {
                $schema['required'] = $required;
            }

            $result['requestBody'] = array(
                'required' => true,
                'content'  => array(
                    'application/json' => array(
                        'schema' => $schema,
                    ),
                ),
            );
        }

        return $result;
    }
}
```

- [ ] **Step 2: Commit OpenAPI generator**

```bash
git add wordpress-plugin/botvisibility/includes/class-openapi-generator.php
git commit -m "feat(wp): add OpenAPI 3.0 generator from WP REST API"
```

---

## Task 5: Virtual Routes & Meta Tags

**Files:**
- Create: `wordpress-plugin/botvisibility/includes/class-virtual-routes.php`
- Create: `wordpress-plugin/botvisibility/includes/class-meta-tags.php`

- [ ] **Step 1: Create virtual routes class**

Create `wordpress-plugin/botvisibility/includes/class-virtual-routes.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class BotVisibility_Virtual_Routes {

    /**
     * Register rewrite rules for virtual files.
     */
    public static function register_rewrite_rules() {
        add_rewrite_rule( '^llms\.txt$', 'index.php?botvis_file=llms-txt', 'top' );
        add_rewrite_rule( '^llms-full\.txt$', 'index.php?botvis_file=llms-txt', 'top' );
        add_rewrite_rule( '^skill\.md$', 'index.php?botvis_file=skill-md', 'top' );
        add_rewrite_rule( '^openapi\.json$', 'index.php?botvis_file=openapi', 'top' );
        add_rewrite_rule( '^\.well-known/llms\.txt$', 'index.php?botvis_file=llms-txt', 'top' );
        add_rewrite_rule( '^\.well-known/agent-card\.json$', 'index.php?botvis_file=agent-card', 'top' );
        add_rewrite_rule( '^\.well-known/ai\.json$', 'index.php?botvis_file=ai-json', 'top' );
        add_rewrite_rule( '^\.well-known/skills/index\.json$', 'index.php?botvis_file=skills-index', 'top' );
        add_rewrite_rule( '^\.well-known/mcp\.json$', 'index.php?botvis_file=mcp-json', 'top' );
        add_rewrite_rule( '^\.well-known/openid-configuration$', 'index.php?botvis_file=openid-config', 'top' );

        add_filter( 'query_vars', array( __CLASS__, 'add_query_vars' ) );
    }

    /**
     * Register custom query var.
     */
    public static function add_query_vars( $vars ) {
        $vars[] = 'botvis_file';
        return $vars;
    }

    /**
     * Handle requests for virtual files.
     */
    public static function handle_request() {
        $file_key = get_query_var( 'botvis_file' );

        if ( empty( $file_key ) ) {
            return;
        }

        $options       = get_option( 'botvisibility_options', array() );
        $enabled_files = $options['enabled_files'] ?? array();

        // Map openid-config to the right key for enabled check.
        $enabled_key = $file_key;

        if ( empty( $enabled_files[ $enabled_key ] ) ) {
            // File type is disabled — let WordPress handle 404.
            return;
        }

        // Check if static file exists and should take precedence.
        $static_paths = array(
            'llms-txt'       => 'llms.txt',
            'agent-card'     => '.well-known/agent-card.json',
            'ai-json'        => '.well-known/ai.json',
            'skills-index'   => '.well-known/skills/index.json',
            'skill-md'       => 'skill.md',
            'openapi'        => 'openapi.json',
            'mcp-json'       => '.well-known/mcp.json',
            'openid-config'  => '.well-known/openid-configuration',
        );

        $relative = $static_paths[ $file_key ] ?? '';
        if ( $relative && file_exists( ABSPATH . $relative ) ) {
            // Static file exists — serve it directly.
            $content = file_get_contents( ABSPATH . $relative );
        } else {
            // Generate dynamically.
            if ( 'openapi' === $file_key ) {
                $spec    = BotVisibility_OpenAPI_Generator::generate();
                $content = wp_json_encode( $spec, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
            } elseif ( 'openid-config' === $file_key ) {
                $content = BotVisibility_File_Generator::generate( 'openid-configuration' );
            } else {
                $content = BotVisibility_File_Generator::generate( $file_key );
            }
        }

        if ( empty( $content ) ) {
            return;
        }

        // Set appropriate content type.
        $content_types = array(
            'llms-txt'      => 'text/plain; charset=utf-8',
            'agent-card'    => 'application/json; charset=utf-8',
            'ai-json'       => 'application/json; charset=utf-8',
            'skills-index'  => 'application/json; charset=utf-8',
            'skill-md'      => 'text/markdown; charset=utf-8',
            'openapi'       => 'application/json; charset=utf-8',
            'mcp-json'      => 'application/json; charset=utf-8',
            'openid-config' => 'application/json; charset=utf-8',
        );

        $content_type = $content_types[ $file_key ] ?? 'text/plain; charset=utf-8';

        header( 'Content-Type: ' . $content_type );
        header( 'X-BotVisibility: virtual' );
        header( 'Cache-Control: public, max-age=3600' );
        echo $content;
        exit;
    }
}
```

- [ ] **Step 2: Create meta tags class**

Create `wordpress-plugin/botvisibility/includes/class-meta-tags.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class BotVisibility_Meta_Tags {

    /**
     * Output AI-related meta tags and link elements in <head>.
     */
    public static function output_meta_tags() {
        $options       = get_option( 'botvisibility_options', array() );
        $enabled_files = $options['enabled_files'] ?? array();
        $description   = $options['site_description'] ?? get_bloginfo( 'description' );

        // AI Meta Tags (check 1.7).
        echo "\n<!-- BotVisibility: AI Discovery Tags -->\n";

        if ( ! empty( $description ) ) {
            printf(
                '<meta name="llms:description" content="%s" />' . "\n",
                esc_attr( $description )
            );
        }

        if ( ! empty( $enabled_files['llms-txt'] ) ) {
            printf(
                '<meta name="llms:url" content="%s" />' . "\n",
                esc_url( home_url( '/llms.txt' ) )
            );
        }

        if ( ! empty( $enabled_files['skill-md'] ) ) {
            printf(
                '<meta name="llms:instructions" content="%s" />' . "\n",
                esc_url( home_url( '/skill.md' ) )
            );
        }

        // Link Headers (check 1.11).
        if ( ! empty( $enabled_files['llms-txt'] ) ) {
            printf(
                '<link rel="alternate" type="text/plain" href="%s" title="LLMs.txt" />' . "\n",
                esc_url( home_url( '/llms.txt' ) )
            );
        }

        if ( ! empty( $enabled_files['ai-json'] ) ) {
            printf(
                '<link rel="alternate" type="application/json" href="%s" title="AI Profile" />' . "\n",
                esc_url( home_url( '/.well-known/ai.json' ) )
            );
        }

        if ( ! empty( $enabled_files['agent-card'] ) ) {
            printf(
                '<link rel="alternate" type="application/json" href="%s" title="Agent Card" />' . "\n",
                esc_url( home_url( '/.well-known/agent-card.json' ) )
            );
        }

        if ( ! empty( $enabled_files['openapi'] ) ) {
            printf(
                '<link rel="alternate" type="application/json" href="%s" title="OpenAPI Spec" />' . "\n",
                esc_url( home_url( '/openapi.json' ) )
            );
        }

        echo "<!-- /BotVisibility -->\n";
    }
}
```

- [ ] **Step 3: Commit virtual routes and meta tags**

```bash
git add wordpress-plugin/botvisibility/includes/class-virtual-routes.php wordpress-plugin/botvisibility/includes/class-meta-tags.php
git commit -m "feat(wp): add virtual routes and meta tag injection"
```

---

## Task 6: REST API Enhancer

**Files:**
- Create: `wordpress-plugin/botvisibility/includes/class-rest-enhancer.php`

- [ ] **Step 1: Create REST enhancer class**

Create `wordpress-plugin/botvisibility/includes/class-rest-enhancer.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class BotVisibility_REST_Enhancer {

    /**
     * Initialize REST API enhancements based on plugin settings.
     */
    public static function init() {
        $options = get_option( 'botvisibility_options', array() );

        if ( ! empty( $options['enable_cors'] ) ) {
            add_filter( 'rest_pre_serve_request', array( __CLASS__, 'add_cors_headers' ), 10, 4 );
        }

        if ( ! empty( $options['enable_rate_limits'] ) ) {
            add_filter( 'rest_post_dispatch', array( __CLASS__, 'add_rate_limit_headers' ), 10, 3 );
        }

        if ( ! empty( $options['enable_cache_headers'] ) ) {
            add_filter( 'rest_post_dispatch', array( __CLASS__, 'add_cache_headers' ), 10, 3 );
        }

        if ( ! empty( $options['enable_idempotency'] ) ) {
            add_filter( 'rest_pre_dispatch', array( __CLASS__, 'handle_idempotency' ), 10, 3 );
        }
    }

    /**
     * Add CORS headers to REST API responses.
     */
    public static function add_cors_headers( $served, $result, $request, $server ) {
        header( 'Access-Control-Allow-Origin: *' );
        header( 'Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS' );
        header( 'Access-Control-Allow-Headers: Content-Type, Authorization, X-WP-Nonce, Idempotency-Key' );
        header( 'Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset' );

        return $served;
    }

    /**
     * Add rate limit headers.
     */
    public static function add_rate_limit_headers( $response, $server, $request ) {
        if ( ! $response instanceof WP_REST_Response ) {
            return $response;
        }

        $limit     = 100;
        $window    = 3600;
        $ip        = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $cache_key = 'botvis_rl_' . md5( $ip );
        $count     = (int) get_transient( $cache_key );

        if ( 0 === $count ) {
            set_transient( $cache_key, 1, $window );
            $count = 1;
        } else {
            set_transient( $cache_key, $count + 1, $window );
            $count++;
        }

        $remaining = max( 0, $limit - $count );
        $reset     = time() + $window;

        $response->header( 'X-RateLimit-Limit', $limit );
        $response->header( 'X-RateLimit-Remaining', $remaining );
        $response->header( 'X-RateLimit-Reset', $reset );

        if ( $count > $limit ) {
            $response->header( 'Retry-After', $window );
        }

        return $response;
    }

    /**
     * Add caching headers (ETag and Cache-Control).
     */
    public static function add_cache_headers( $response, $server, $request ) {
        if ( ! $response instanceof WP_REST_Response ) {
            return $response;
        }

        // Only cache GET requests.
        if ( 'GET' !== $request->get_method() ) {
            return $response;
        }

        $data = $response->get_data();
        $etag = '"' . md5( wp_json_encode( $data ) ) . '"';

        $response->header( 'ETag', $etag );
        $response->header( 'Cache-Control', 'public, max-age=60' );
        $response->header( 'Last-Modified', gmdate( 'D, d M Y H:i:s' ) . ' GMT' );

        // Handle If-None-Match for 304 responses.
        $if_none_match = $request->get_header( 'if_none_match' );
        if ( $if_none_match && trim( $if_none_match, '"' ) === trim( $etag, '"' ) ) {
            $response->set_status( 304 );
            $response->set_data( null );
        }

        return $response;
    }

    /**
     * Handle Idempotency-Key header for write operations.
     */
    public static function handle_idempotency( $result, $server, $request ) {
        $idempotency_key = $request->get_header( 'idempotency_key' );

        if ( empty( $idempotency_key ) ) {
            return $result;
        }

        if ( 'GET' === $request->get_method() ) {
            return $result;
        }

        $cache_key = 'botvis_idem_' . md5( $idempotency_key );
        $cached    = get_transient( $cache_key );

        if ( false !== $cached ) {
            // Return cached response.
            $response = new WP_REST_Response( $cached['data'], $cached['status'] );
            $response->header( 'X-Idempotency-Replay', 'true' );
            return $response;
        }

        // Store a hook to cache the response after dispatch.
        add_filter( 'rest_post_dispatch', function( $response ) use ( $cache_key ) {
            if ( $response instanceof WP_REST_Response ) {
                $cached = array(
                    'data'   => $response->get_data(),
                    'status' => $response->get_status(),
                );
                set_transient( $cache_key, $cached, DAY_IN_SECONDS );
            }
            return $response;
        }, 5 );

        return $result;
    }
}
```

- [ ] **Step 2: Commit REST enhancer**

```bash
git add wordpress-plugin/botvisibility/includes/class-rest-enhancer.php
git commit -m "feat(wp): add REST API enhancer (CORS, rate limits, caching, idempotency)"
```

---

## Task 7: Admin UI — PHP Views & AJAX Handlers

**Files:**
- Create: `wordpress-plugin/botvisibility/includes/class-admin.php`
- Create: `wordpress-plugin/botvisibility/admin/views/dashboard.php`
- Create: `wordpress-plugin/botvisibility/admin/views/level-detail.php`
- Create: `wordpress-plugin/botvisibility/admin/views/file-generator.php`
- Create: `wordpress-plugin/botvisibility/admin/views/settings.php`

- [ ] **Step 1: Create admin class**

Create `wordpress-plugin/botvisibility/includes/class-admin.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class BotVisibility_Admin {

    /**
     * Initialize admin hooks.
     */
    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'add_menu' ) );
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
        add_action( 'wp_ajax_botvis_scan', array( __CLASS__, 'ajax_scan' ) );
        add_action( 'wp_ajax_botvis_fix', array( __CLASS__, 'ajax_fix' ) );
        add_action( 'wp_ajax_botvis_fix_all', array( __CLASS__, 'ajax_fix_all' ) );
        add_action( 'wp_ajax_botvis_export', array( __CLASS__, 'ajax_export' ) );
        add_action( 'wp_ajax_botvis_save_settings', array( __CLASS__, 'ajax_save_settings' ) );
        add_action( 'wp_ajax_botvis_toggle_file', array( __CLASS__, 'ajax_toggle_file' ) );
        add_action( 'wp_ajax_botvis_save_custom_content', array( __CLASS__, 'ajax_save_custom_content' ) );
        add_action( 'wp_ajax_botvis_preview_file', array( __CLASS__, 'ajax_preview_file' ) );
    }

    /**
     * Add admin menu page.
     */
    public static function add_menu() {
        add_menu_page(
            'BotVisibility',
            'BotVisibility',
            'manage_options',
            'botvisibility',
            array( __CLASS__, 'render_page' ),
            'dashicons-visibility',
            80
        );
    }

    /**
     * Enqueue admin CSS and JS.
     */
    public static function enqueue_assets( $hook ) {
        if ( 'toplevel_page_botvisibility' !== $hook ) {
            return;
        }

        wp_enqueue_style(
            'botvisibility-admin',
            BOTVIS_PLUGIN_URL . 'admin/css/admin.css',
            array(),
            BOTVIS_VERSION
        );

        wp_enqueue_script(
            'botvisibility-admin',
            BOTVIS_PLUGIN_URL . 'admin/js/admin.js',
            array(),
            BOTVIS_VERSION,
            true
        );

        wp_localize_script( 'botvisibility-admin', 'botvisData', array(
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce'   => wp_create_nonce( 'botvis_nonce' ),
            'homeUrl' => home_url(),
            'levels'  => BotVisibility_Scoring::LEVELS,
            'checks'  => BotVisibility_Scoring::CHECK_DEFINITIONS,
        ));
    }

    /**
     * Render admin page.
     */
    public static function render_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized' );
        }

        $tab     = isset( $_GET['tab'] ) ? sanitize_key( $_GET['tab'] ) : 'dashboard';
        $options = get_option( 'botvisibility_options', array() );
        $cached  = get_transient( 'botvis_scan_results' );

        echo '<div class="botvisibility-admin">';
        echo '<div class="botvis-header">';
        echo '<div class="botvis-logo-area">';
        echo '<svg class="botvis-logo-icon" width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="6" stroke="currentColor" stroke-width="2"/><line x1="16" y1="2" x2="16" y2="8" stroke="currentColor" stroke-width="2"/><line x1="16" y1="24" x2="16" y2="30" stroke="currentColor" stroke-width="2"/><line x1="2" y1="16" x2="8" y2="16" stroke="currentColor" stroke-width="2"/><line x1="24" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="2"/></svg>';
        echo '<h1>BotVisibility</h1>';
        echo '</div>';
        echo '</div>';

        // Tab navigation.
        $tabs = array(
            'dashboard'      => 'Dashboard',
            'scan-results'   => 'Scan Results',
            'file-generator' => 'File Manager',
            'settings'       => 'Settings',
        );

        echo '<nav class="botvis-tabs">';
        foreach ( $tabs as $tab_key => $label ) {
            $active = ( $tab === $tab_key ) ? ' active' : '';
            printf(
                '<a href="%s" class="botvis-tab%s">%s</a>',
                esc_url( admin_url( 'admin.php?page=botvisibility&tab=' . $tab_key ) ),
                $active,
                esc_html( $label )
            );
        }
        echo '</nav>';

        echo '<div class="botvis-content">';

        switch ( $tab ) {
            case 'scan-results':
                include BOTVIS_PLUGIN_DIR . 'admin/views/level-detail.php';
                break;
            case 'file-generator':
                include BOTVIS_PLUGIN_DIR . 'admin/views/file-generator.php';
                break;
            case 'settings':
                include BOTVIS_PLUGIN_DIR . 'admin/views/settings.php';
                break;
            default:
                include BOTVIS_PLUGIN_DIR . 'admin/views/dashboard.php';
                break;
        }

        echo '</div>'; // .botvis-content
        echo '</div>'; // .botvisibility-admin
    }

    /**
     * AJAX: Run scan.
     */
    public static function ajax_scan() {
        check_ajax_referer( 'botvis_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized' );
        }

        $result = BotVisibility_Scanner::run_all_checks();
        wp_send_json_success( $result );
    }

    /**
     * AJAX: Fix a single check by enabling its file.
     */
    public static function ajax_fix() {
        check_ajax_referer( 'botvis_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized' );
        }

        $check_id = sanitize_text_field( $_POST['check_id'] ?? '' );
        $options  = get_option( 'botvisibility_options', array() );

        // Map check IDs to fixable file keys or settings.
        $fix_map = array(
            '1.1'  => array( 'file' => 'llms-txt' ),
            '1.2'  => array( 'file' => 'agent-card' ),
            '1.3'  => array( 'file' => 'openapi' ),
            '1.4'  => array( 'setting' => 'robots_ai_policy', 'value' => 'allow' ),
            '1.6'  => array( 'setting' => 'enable_cors', 'value' => true ),
            '1.7'  => array( 'meta_tags' => true ),
            '1.8'  => array( 'file' => 'skill-md' ),
            '1.9'  => array( 'file' => 'ai-json' ),
            '1.10' => array( 'file' => 'skills-index' ),
            '1.11' => array( 'meta_tags' => true ),
            '1.12' => array( 'file' => 'mcp-json' ),
            '2.9'  => array( 'setting' => 'enable_idempotency', 'value' => true ),
            '3.5'  => array( 'setting' => 'enable_rate_limits', 'value' => true ),
            '3.6'  => array( 'setting' => 'enable_cache_headers', 'value' => true ),
        );

        if ( ! isset( $fix_map[ $check_id ] ) ) {
            wp_send_json_error( 'This check cannot be auto-fixed.' );
        }

        $fix = $fix_map[ $check_id ];

        if ( isset( $fix['file'] ) ) {
            if ( ! isset( $options['enabled_files'] ) ) {
                $options['enabled_files'] = array();
            }
            $options['enabled_files'][ $fix['file'] ] = true;
        }

        if ( isset( $fix['setting'] ) ) {
            $options[ $fix['setting'] ] = $fix['value'];
        }

        update_option( 'botvisibility_options', $options );

        // Flush rewrite rules if we enabled new files.
        if ( isset( $fix['file'] ) ) {
            flush_rewrite_rules();
        }

        wp_send_json_success( array( 'message' => 'Fixed', 'check_id' => $check_id ) );
    }

    /**
     * AJAX: Fix all failing checks.
     */
    public static function ajax_fix_all() {
        check_ajax_referer( 'botvis_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized' );
        }

        $options = get_option( 'botvisibility_options', array() );

        // Enable all files.
        $options['enabled_files'] = array(
            'llms-txt'     => true,
            'agent-card'   => true,
            'ai-json'      => true,
            'skill-md'     => true,
            'skills-index' => true,
            'openapi'      => true,
            'mcp-json'     => true,
        );

        // Enable all REST enhancements.
        $options['enable_cors']          = true;
        $options['enable_cache_headers'] = true;
        $options['enable_rate_limits']   = true;
        $options['enable_idempotency']   = true;
        $options['robots_ai_policy']     = 'allow';

        update_option( 'botvisibility_options', $options );
        flush_rewrite_rules();

        wp_send_json_success( array( 'message' => 'All fixable checks have been resolved.' ) );
    }

    /**
     * AJAX: Export file to static.
     */
    public static function ajax_export() {
        check_ajax_referer( 'botvis_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized' );
        }

        $file_key = sanitize_key( $_POST['file_key'] ?? '' );
        $result   = BotVisibility_File_Generator::export_static( $file_key );

        if ( is_wp_error( $result ) ) {
            wp_send_json_error( $result->get_error_message() );
        }

        wp_send_json_success( array( 'message' => 'Exported to static file.' ) );
    }

    /**
     * AJAX: Save settings.
     */
    public static function ajax_save_settings() {
        check_ajax_referer( 'botvis_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized' );
        }

        $options = get_option( 'botvisibility_options', array() );

        if ( isset( $_POST['site_description'] ) ) {
            $options['site_description'] = sanitize_textarea_field( $_POST['site_description'] );
        }
        if ( isset( $_POST['capabilities'] ) && is_array( $_POST['capabilities'] ) ) {
            $options['capabilities'] = array_map( 'sanitize_key', $_POST['capabilities'] );
        }
        if ( isset( $_POST['enable_cors'] ) ) {
            $options['enable_cors'] = (bool) $_POST['enable_cors'];
        }
        if ( isset( $_POST['enable_cache_headers'] ) ) {
            $options['enable_cache_headers'] = (bool) $_POST['enable_cache_headers'];
        }
        if ( isset( $_POST['enable_rate_limits'] ) ) {
            $options['enable_rate_limits'] = (bool) $_POST['enable_rate_limits'];
        }
        if ( isset( $_POST['enable_idempotency'] ) ) {
            $options['enable_idempotency'] = (bool) $_POST['enable_idempotency'];
        }
        if ( isset( $_POST['robots_ai_policy'] ) ) {
            $options['robots_ai_policy'] = sanitize_key( $_POST['robots_ai_policy'] );
        }
        if ( isset( $_POST['auto_scan_schedule'] ) ) {
            $options['auto_scan_schedule'] = sanitize_key( $_POST['auto_scan_schedule'] );
        }
        if ( isset( $_POST['remove_files_on_deactivate'] ) ) {
            $options['remove_files_on_deactivate'] = (bool) $_POST['remove_files_on_deactivate'];
        }

        update_option( 'botvisibility_options', $options );
        wp_send_json_success( array( 'message' => 'Settings saved.' ) );
    }

    /**
     * AJAX: Toggle a file on/off.
     */
    public static function ajax_toggle_file() {
        check_ajax_referer( 'botvis_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized' );
        }

        $file_key = sanitize_key( $_POST['file_key'] ?? '' );
        $enabled  = (bool) ( $_POST['enabled'] ?? false );
        $options  = get_option( 'botvisibility_options', array() );

        if ( ! isset( $options['enabled_files'] ) ) {
            $options['enabled_files'] = array();
        }

        $options['enabled_files'][ $file_key ] = $enabled;
        update_option( 'botvisibility_options', $options );
        flush_rewrite_rules();

        wp_send_json_success( array( 'message' => $enabled ? 'Enabled' : 'Disabled' ) );
    }

    /**
     * AJAX: Save custom content for a file.
     */
    public static function ajax_save_custom_content() {
        check_ajax_referer( 'botvis_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized' );
        }

        $file_key = sanitize_key( $_POST['file_key'] ?? '' );
        $content  = wp_unslash( $_POST['content'] ?? '' );
        $options  = get_option( 'botvisibility_options', array() );

        if ( ! isset( $options['custom_content'] ) ) {
            $options['custom_content'] = array();
        }

        $options['custom_content'][ $file_key ] = $content;
        update_option( 'botvisibility_options', $options );

        wp_send_json_success( array( 'message' => 'Content saved.' ) );
    }

    /**
     * AJAX: Preview generated file content.
     */
    public static function ajax_preview_file() {
        check_ajax_referer( 'botvis_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized' );
        }

        $file_key = sanitize_key( $_POST['file_key'] ?? '' );

        if ( 'openapi' === $file_key ) {
            $spec    = BotVisibility_OpenAPI_Generator::generate();
            $content = wp_json_encode( $spec, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
        } else {
            $content = BotVisibility_File_Generator::generate( $file_key );
        }

        wp_send_json_success( array( 'content' => $content ) );
    }
}
```

- [ ] **Step 2: Create dashboard view**

Create `wordpress-plugin/botvisibility/admin/views/dashboard.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$levels_data = BotVisibility_Scoring::LEVELS;
?>
<div class="botvis-dashboard">
    <div id="botvis-scan-area">
        <?php if ( $cached ) : ?>
            <div id="botvis-results" data-results="<?php echo esc_attr( wp_json_encode( $cached ) ); ?>">
                <?php
                $total_passed     = 0;
                $total_applicable = 0;
                foreach ( $cached['levels'] as $lp ) {
                    $total_passed     += $lp['passed'];
                    $total_applicable += $lp['total'] - $lp['na'];
                }
                $current = $cached['currentLevel'];
                $level   = $current > 0 ? $levels_data[ $current ] : null;
                ?>
                <div class="botvis-score-header">
                    <div class="botvis-level-info">
                        <div class="botvis-level-name" style="color: <?php echo $level ? esc_attr( $level['color'] ) : 'var(--text-inverse)'; ?>">
                            <?php echo $level ? sprintf( 'Level %d: %s', $current, esc_html( $level['name'] ) ) : 'Getting Started'; ?>
                        </div>
                        <div class="botvis-level-desc">
                            <?php echo $level ? esc_html( $level['description'] ) : 'Start by making your site discoverable to AI agents.'; ?>
                        </div>
                    </div>
                    <div class="botvis-score-number">
                        <span class="botvis-score-value"><?php echo (int) $total_passed; ?></span><span class="botvis-score-total">/<?php echo (int) $total_applicable; ?></span>
                        <div class="botvis-score-label">checks passed</div>
                    </div>
                </div>

                <div class="botvis-thermometer">
                    <div class="botvis-thermometer-fill" style="width: <?php echo $total_applicable > 0 ? round( ( $total_passed / $total_applicable ) * 100 ) : 0; ?>%"></div>
                    <div class="botvis-thermometer-needle" style="left: <?php echo $total_applicable > 0 ? round( ( $total_passed / $total_applicable ) * 100 ) : 0; ?>%"></div>
                </div>

                <div class="botvis-level-bars">
                    <?php foreach ( $cached['levels'] as $num => $lp ) : ?>
                        <?php
                        $applicable = $lp['total'] - $lp['na'];
                        $pct        = $applicable > 0 ? round( ( $lp['passed'] / $applicable ) * 100 ) : 0;
                        ?>
                        <div class="botvis-level-bar">
                            <div class="botvis-level-bar-label">
                                <span style="color: <?php echo esc_attr( $lp['level']['color'] ); ?>">L<?php echo (int) $num; ?>: <?php echo esc_html( $lp['level']['name'] ); ?></span>
                                <span><?php echo (int) $lp['passed']; ?>/<?php echo (int) $applicable; ?></span>
                            </div>
                            <div class="botvis-progress-track">
                                <div class="botvis-progress-fill" style="width: <?php echo (int) $pct; ?>%; background: <?php echo esc_attr( $lp['level']['color'] ); ?>"></div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>

                <div class="botvis-scan-meta">
                    Last scanned: <?php echo esc_html( $cached['timestamp'] ); ?>
                </div>
            </div>
        <?php else : ?>
            <div class="botvis-empty-state">
                <svg width="64" height="64" viewBox="0 0 32 32" fill="none" style="opacity:0.3"><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="6" stroke="currentColor" stroke-width="2"/></svg>
                <p>No scan results yet. Click "Scan Now" to analyze your site.</p>
            </div>
        <?php endif; ?>
    </div>

    <div class="botvis-actions">
        <button id="botvis-scan-btn" class="botvis-btn botvis-btn-primary">Scan Now</button>
        <button id="botvis-fix-all-btn" class="botvis-btn botvis-btn-secondary">Fix All</button>
    </div>

    <div id="botvis-scanning-progress" style="display:none">
        <div class="botvis-spinner"></div>
        <div class="botvis-scanning-text">Scanning...</div>
    </div>

    <?php if ( $cached ) : ?>
        <div class="botvis-badge-embed">
            <h3>Badge Embed Code</h3>
            <code class="botvis-embed-code">&lt;a href="https://botvisibility.com"&gt;&lt;img src="https://botvisibility.com/api/badge?url=<?php echo urlencode( home_url() ); ?>" alt="BotVisibility Score" /&gt;&lt;/a&gt;</code>
        </div>
    <?php endif; ?>
</div>
```

- [ ] **Step 3: Create level detail view**

Create `wordpress-plugin/botvisibility/admin/views/level-detail.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$sub_tab     = isset( $_GET['level'] ) ? (int) $_GET['level'] : 1;
$levels_data = BotVisibility_Scoring::LEVELS;
$all_checks  = BotVisibility_Scoring::CHECK_DEFINITIONS;
?>

<div class="botvis-level-detail">
    <nav class="botvis-sub-tabs">
        <?php foreach ( $levels_data as $num => $level ) : ?>
            <a href="<?php echo esc_url( admin_url( 'admin.php?page=botvisibility&tab=scan-results&level=' . $num ) ); ?>"
               class="botvis-sub-tab<?php echo $sub_tab === $num ? ' active' : ''; ?>"
               style="<?php echo $sub_tab === $num ? 'border-color:' . esc_attr( $level['color'] ) : ''; ?>">
                L<?php echo (int) $num; ?>: <?php echo esc_html( $level['name'] ); ?>
            </a>
        <?php endforeach; ?>
    </nav>

    <div id="botvis-check-list" data-level="<?php echo (int) $sub_tab; ?>">
        <?php
        $level_checks = array_filter( $all_checks, function( $c ) use ( $sub_tab ) {
            return (int) $c['level'] === $sub_tab;
        });

        $results = $cached['checks'] ?? array();
        $results_by_id = array();
        foreach ( $results as $r ) {
            $results_by_id[ $r['id'] ] = $r;
        }

        foreach ( $level_checks as $check ) :
            $result = $results_by_id[ $check['id'] ] ?? null;
            $status = $result ? $result['status'] : 'unknown';
            $status_class = 'botvis-status-' . $status;
        ?>
            <div class="botvis-check-item <?php echo esc_attr( $status_class ); ?>" data-check-id="<?php echo esc_attr( $check['id'] ); ?>">
                <button type="button" class="botvis-check-header" aria-expanded="false">
                    <span class="botvis-check-status-icon" data-status="<?php echo esc_attr( $status ); ?>"></span>
                    <span class="botvis-check-id"><?php echo esc_html( $check['id'] ); ?></span>
                    <span class="botvis-check-name"><?php echo esc_html( $check['name'] ); ?></span>
                    <span class="botvis-check-caret">&#9660;</span>
                </button>
                <div class="botvis-check-details" style="display:none">
                    <p class="botvis-check-desc"><?php echo esc_html( $check['description'] ); ?></p>
                    <?php if ( $result ) : ?>
                        <p class="botvis-check-message"><?php echo esc_html( $result['message'] ); ?></p>
                        <?php if ( ! empty( $result['details'] ) ) : ?>
                            <p class="botvis-check-detail-text"><?php echo esc_html( $result['details'] ); ?></p>
                        <?php endif; ?>
                        <?php if ( ! empty( $result['recommendation'] ) ) : ?>
                            <p class="botvis-check-recommendation"><?php echo esc_html( $result['recommendation'] ); ?></p>
                        <?php endif; ?>
                        <?php if ( 'pass' !== $status && 'na' !== $status ) : ?>
                            <button type="button" class="botvis-btn botvis-btn-fix" data-check-id="<?php echo esc_attr( $check['id'] ); ?>">Fix</button>
                        <?php endif; ?>
                    <?php else : ?>
                        <p class="botvis-check-no-result">Run a scan to see results for this check.</p>
                    <?php endif; ?>
                </div>
            </div>
        <?php endforeach; ?>
    </div>
</div>
```

- [ ] **Step 4: Create file generator view**

Create `wordpress-plugin/botvisibility/admin/views/file-generator.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$enabled_files = $options['enabled_files'] ?? array();

$files = array(
    'llms-txt'     => array( 'name' => 'llms.txt',               'path' => '/llms.txt',                         'type' => 'text/plain' ),
    'agent-card'   => array( 'name' => 'Agent Card',             'path' => '/.well-known/agent-card.json',      'type' => 'application/json' ),
    'ai-json'      => array( 'name' => 'AI Site Profile',        'path' => '/.well-known/ai.json',              'type' => 'application/json' ),
    'skill-md'     => array( 'name' => 'Skill File',             'path' => '/skill.md',                         'type' => 'text/markdown' ),
    'skills-index' => array( 'name' => 'Skills Index',           'path' => '/.well-known/skills/index.json',    'type' => 'application/json' ),
    'openapi'      => array( 'name' => 'OpenAPI Spec',           'path' => '/openapi.json',                     'type' => 'application/json' ),
    'mcp-json'     => array( 'name' => 'MCP Manifest',           'path' => '/.well-known/mcp.json',             'type' => 'application/json' ),
);
?>

<div class="botvis-file-manager">
    <div class="botvis-file-actions-bar">
        <button id="botvis-enable-all-btn" class="botvis-btn botvis-btn-secondary">Enable All</button>
        <button id="botvis-export-all-btn" class="botvis-btn botvis-btn-secondary">Export All to Static</button>
    </div>

    <table class="botvis-file-table">
        <thead>
            <tr>
                <th>File</th>
                <th>Path</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ( $files as $key => $file ) :
                $is_enabled  = ! empty( $enabled_files[ $key ] );
                $has_static  = file_exists( ABSPATH . ltrim( $file['path'], '/' ) );
                $has_custom  = ! empty( $options['custom_content'][ $key ] );

                if ( $has_static ) {
                    $status_label = 'Static';
                    $status_class = 'botvis-file-static';
                } elseif ( $is_enabled ) {
                    $status_label = 'Virtual';
                    $status_class = 'botvis-file-virtual';
                } else {
                    $status_label = 'Disabled';
                    $status_class = 'botvis-file-disabled';
                }
            ?>
                <tr class="<?php echo esc_attr( $status_class ); ?>" data-file-key="<?php echo esc_attr( $key ); ?>">
                    <td class="botvis-file-name"><?php echo esc_html( $file['name'] ); ?></td>
                    <td class="botvis-file-path"><code><?php echo esc_html( $file['path'] ); ?></code></td>
                    <td><span class="botvis-file-status-badge"><?php echo esc_html( $status_label ); ?></span></td>
                    <td class="botvis-file-actions">
                        <button type="button" class="botvis-btn-sm botvis-preview-btn" data-file-key="<?php echo esc_attr( $key ); ?>">Preview</button>
                        <button type="button" class="botvis-btn-sm botvis-edit-btn" data-file-key="<?php echo esc_attr( $key ); ?>">Edit</button>
                        <label class="botvis-toggle">
                            <input type="checkbox" class="botvis-toggle-file" data-file-key="<?php echo esc_attr( $key ); ?>" <?php checked( $is_enabled ); ?>>
                            <span class="botvis-toggle-slider"></span>
                        </label>
                        <button type="button" class="botvis-btn-sm botvis-export-btn" data-file-key="<?php echo esc_attr( $key ); ?>">Export</button>
                    </td>
                </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div id="botvis-file-modal" class="botvis-modal" style="display:none">
    <div class="botvis-modal-content">
        <div class="botvis-modal-header">
            <h3 id="botvis-modal-title">Preview</h3>
            <button type="button" class="botvis-modal-close">&times;</button>
        </div>
        <div class="botvis-modal-body">
            <textarea id="botvis-modal-editor" rows="20"></textarea>
        </div>
        <div class="botvis-modal-footer">
            <button type="button" class="botvis-btn botvis-btn-secondary botvis-modal-close">Cancel</button>
            <button type="button" id="botvis-modal-save" class="botvis-btn botvis-btn-primary">Save</button>
        </div>
    </div>
</div>
```

- [ ] **Step 5: Create settings view**

Create `wordpress-plugin/botvisibility/admin/views/settings.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$capabilities_options = array(
    'content'     => 'Content / Blog',
    'api'         => 'API / Developer Platform',
    'ecommerce'   => 'E-Commerce',
    'saas'        => 'SaaS Application',
    'community'   => 'Community / Forum',
    'docs'        => 'Documentation',
    'media'       => 'Media / Images / Video',
    'education'   => 'Education / Courses',
);

$selected_caps = $options['capabilities'] ?? array( 'content' );
?>

<div class="botvis-settings">
    <form id="botvis-settings-form">
        <div class="botvis-setting-group">
            <h3>Site Description</h3>
            <p class="botvis-setting-desc">Used in llms.txt, agent-card.json, and other generated files.</p>
            <textarea name="site_description" rows="3" class="botvis-textarea"><?php echo esc_textarea( $options['site_description'] ?? get_bloginfo( 'description' ) ); ?></textarea>
        </div>

        <div class="botvis-setting-group">
            <h3>Capabilities</h3>
            <p class="botvis-setting-desc">What does your site offer? Included in agent-card.json and ai.json.</p>
            <div class="botvis-checkboxes">
                <?php foreach ( $capabilities_options as $value => $label ) : ?>
                    <label class="botvis-checkbox-label">
                        <input type="checkbox" name="capabilities[]" value="<?php echo esc_attr( $value ); ?>" <?php checked( in_array( $value, $selected_caps, true ) ); ?>>
                        <?php echo esc_html( $label ); ?>
                    </label>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="botvis-setting-group">
            <h3>REST API Enhancements</h3>
            <p class="botvis-setting-desc">Toggle additional headers on your REST API responses.</p>

            <label class="botvis-switch-label">
                <input type="checkbox" name="enable_cors" value="1" <?php checked( ! empty( $options['enable_cors'] ) ); ?>>
                <span>CORS Headers</span> <small>Allow cross-origin API access</small>
            </label>

            <label class="botvis-switch-label">
                <input type="checkbox" name="enable_cache_headers" value="1" <?php checked( ! empty( $options['enable_cache_headers'] ) ); ?>>
                <span>Caching Headers</span> <small>Add ETag and Cache-Control</small>
            </label>

            <label class="botvis-switch-label">
                <input type="checkbox" name="enable_rate_limits" value="1" <?php checked( ! empty( $options['enable_rate_limits'] ) ); ?>>
                <span>Rate Limit Headers</span> <small>Add X-RateLimit-* headers</small>
            </label>

            <label class="botvis-switch-label">
                <input type="checkbox" name="enable_idempotency" value="1" <?php checked( ! empty( $options['enable_idempotency'] ) ); ?>>
                <span>Idempotency Support</span> <small>Accept Idempotency-Key header</small>
            </label>
        </div>

        <div class="botvis-setting-group">
            <h3>robots.txt AI Policy</h3>
            <p class="botvis-setting-desc">How should AI crawlers be handled?</p>
            <select name="robots_ai_policy" class="botvis-select">
                <option value="allow" <?php selected( $options['robots_ai_policy'] ?? 'allow', 'allow' ); ?>>Allow AI crawlers</option>
                <option value="block" <?php selected( $options['robots_ai_policy'] ?? 'allow', 'block' ); ?>>Block AI crawlers</option>
            </select>
        </div>

        <div class="botvis-setting-group">
            <h3>Auto-Scan Schedule</h3>
            <select name="auto_scan_schedule" class="botvis-select">
                <option value="daily" <?php selected( $options['auto_scan_schedule'] ?? 'weekly', 'daily' ); ?>>Daily</option>
                <option value="weekly" <?php selected( $options['auto_scan_schedule'] ?? 'weekly', 'weekly' ); ?>>Weekly</option>
                <option value="disabled" <?php selected( $options['auto_scan_schedule'] ?? 'weekly', 'disabled' ); ?>>Disabled</option>
            </select>
        </div>

        <div class="botvis-setting-group">
            <h3>Cleanup</h3>
            <label class="botvis-switch-label">
                <input type="checkbox" name="remove_files_on_deactivate" value="1" <?php checked( ! empty( $options['remove_files_on_deactivate'] ) ); ?>>
                <span>Remove generated static files on deactivation</span>
            </label>
        </div>

        <div class="botvis-setting-actions">
            <button type="submit" class="botvis-btn botvis-btn-primary">Save Settings</button>
        </div>
    </form>
</div>
```

- [ ] **Step 6: Commit admin UI PHP**

```bash
git add wordpress-plugin/botvisibility/includes/class-admin.php wordpress-plugin/botvisibility/admin/views/
git commit -m "feat(wp): add admin UI with dashboard, scan results, file manager, and settings views"
```

---

## Task 8: Admin CSS (Dark Theme Matching botvisibility.com)

**Files:**
- Create: `wordpress-plugin/botvisibility/admin/css/admin.css`

- [ ] **Step 1: Create admin CSS**

Create `wordpress-plugin/botvisibility/admin/css/admin.css` with the scoped dark theme matching botvisibility.com's visual design. This is a large file — key elements:

- Scoped under `.botvisibility-admin` to avoid bleeding into WP admin
- Dark surface colors: `#0a0a0a` background, `#111` cards, `#1a1a1a` borders
- Gradient thermometer bar: `linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #22c55e, #2563eb)`
- Rainbow gradient score text
- Level colors: L1 `#ef4444`, L2 `#f59e0b`, L3 `#22c55e`
- Status icons via CSS pseudo-elements (green circle, red X, amber triangle, gray question)
- Animated thermometer fill and check card slide-in
- Modal for file preview/edit
- Toggle switches for file enable/disable
- Responsive layout

Full CSS file content should be created during implementation with all these design tokens.

- [ ] **Step 2: Commit CSS**

```bash
git add wordpress-plugin/botvisibility/admin/css/admin.css
git commit -m "feat(wp): add dark-themed admin CSS matching botvisibility.com"
```

---

## Task 9: Admin JavaScript (AJAX & UI Interactions)

**Files:**
- Create: `wordpress-plugin/botvisibility/admin/js/admin.js`

- [ ] **Step 1: Create admin JavaScript**

Create `wordpress-plugin/botvisibility/admin/js/admin.js` with:

- Scan Now button: AJAX call to `botvis_scan`, show spinner, render results progressively
- Fix button: per-check AJAX call to `botvis_fix`
- Fix All button: AJAX call to `botvis_fix_all`, then re-scan
- Check card expand/collapse toggle
- File toggle switches: AJAX call to `botvis_toggle_file`
- File preview modal: AJAX call to `botvis_preview_file`
- File edit + save: populate modal, AJAX call to `botvis_save_custom_content`
- File export: AJAX call to `botvis_export`
- Settings form submit: serialize form, AJAX call to `botvis_save_settings`
- Tab navigation (handled by PHP page reload, but sub-tabs for L1/L2/L3 within scan results)
- Thermometer animation on results load
- Confetti animation on level achievement (comparing previous vs new level)

Full JS file content should be created during implementation.

- [ ] **Step 2: Commit JS**

```bash
git add wordpress-plugin/botvisibility/admin/js/admin.js
git commit -m "feat(wp): add admin JS for AJAX scanning, fix buttons, and UI interactions"
```

---

## Task 10: Logo Asset & Final Assembly

**Files:**
- Create: `wordpress-plugin/botvisibility/assets/logo.svg`

- [ ] **Step 1: Create logo SVG**

Create `wordpress-plugin/botvisibility/assets/logo.svg` — a simple radar/visibility icon matching the BotVisibility brand.

- [ ] **Step 2: Verify all files are in place**

```bash
find wordpress-plugin/botvisibility -type f | sort
```

Expected output should list all files from the file structure in this plan.

- [ ] **Step 3: Final commit**

```bash
git add wordpress-plugin/botvisibility/assets/
git commit -m "feat(wp): add logo asset and complete plugin assembly"
```

---

## Task 11: Verify Plugin Structure

- [ ] **Step 1: Validate PHP syntax for all files**

```bash
find wordpress-plugin/botvisibility -name "*.php" -exec php -l {} \;
```

Expected: No syntax errors.

- [ ] **Step 2: Verify all class references resolve**

Check that every class referenced in `botvisibility.php` exists:
- `BotVisibility_Scoring` → `includes/class-scoring.php`
- `BotVisibility_Scanner` → `includes/class-scanner.php`
- `BotVisibility_File_Generator` → `includes/class-file-generator.php`
- `BotVisibility_OpenAPI_Generator` → `includes/class-openapi-generator.php`
- `BotVisibility_Virtual_Routes` → `includes/class-virtual-routes.php`
- `BotVisibility_Meta_Tags` → `includes/class-meta-tags.php`
- `BotVisibility_Admin` → `includes/class-admin.php`
- `BotVisibility_REST_Enhancer` → `includes/class-rest-enhancer.php`

- [ ] **Step 3: Commit all verified**

```bash
git add -A wordpress-plugin/ && git status
git commit -m "chore(wp): verify plugin structure and PHP syntax"
```
