/**
 * Acute.js
 * http://acute.io
 * MIT licensed
 *
 * Copyright (C) 2013 CJ Cenizal, http://cenizal.com
 */


/*
Todo:
- DONE: Abstract pageLoadCallbacks so we can specify our behavior externally ( onPageLoad( fn ), onSiteLoad( fn ) )
- Deflate makeBlog, so that it's a series of abstract method calls. Could be more FP-like.
- Abstract addition of directives so that directives are stored externally in their own JS files. Follow a pattern.
- Remove dependency on jQUery from angular-blog.js.
- Remove dependency on _ too, if possible.
*/

var Acute = window[ 'Acute' ] = ( function( window, document, undefined ) {

  /**
   * Make an Acute blog.
   *
   * @param {String} name The name of the site.
   * @param {Object} site The JSON data defining the site structure.
   * @returns {Object} An AngularJS app decorated with Acute blog methods.
   */
  function Acute( params ) {

    //-------------------------------------------------------------//
    //------------------------ VARIABLES --------------------------//
    //-------------------------------------------------------------//

    var ng,
      app,
      pages = [],
      posts = [],
      work = [],
      pageLoadCallbacks = [],
      siteLoadCallbacks = [],
      isSiteLoaded = false;

    //-------------------------------------------------------------//
    //------------------------- METHODS ---------------------------//
    //-------------------------------------------------------------//

    // Extract params.
    var siteName = params[ 'name' ],
        jsonUrl = params[ 'data' ];

    function load( url ) {
      url = url || jsonUrl;
      ajax( jsonUrl ).then( function( siteJson ) {
        buildApp( siteJson );
      } );
    }

    function buildApp( siteJson ) {
      var siteStructure = JSON.parse( siteJson );

      // Extract site data.
      // TO-DO: Throw errors if any data has been left unspecified.
      var postsData   = siteStructure[ 'posts' ],
          pagesData   = siteStructure[ 'pages' ],
          workData    = siteStructure[ 'work' ],
          foldersData = siteStructure[ 'folders' ],
          postData    = siteStructure[ 'post' ];

      work = app.work = workData;

      // For each directory in our site structure, create a method
      // allowing us to synthesize a URL to a page within it.
      app.pathTo = {};
      _.each( foldersData, function( folder ) {

        // Get a URL to a page in a directory, given the page's name.
        // E.g. pathTo.posts( 'fun' ) returns post/fun.html
        // Should be getUrlTo( 'posts', 'fun' );
        app.pathTo[ folder.contentType ] = function( pageName ) {
          return folder.name + '/' + pageName + '.html';
        };

      } );

      // Store our posts JSON data.
      posts = postsData;
      _.each( posts, function( post, index ) {
        // Assign an index value to each post if it doesn't have one yet.
        if ( no( post.index ) ) {
          post.index = posts.length - index;
        }
      } );

      /**
       * Get a post with a given ID.
       *
       * @param id {String} The post ID.
       */
      var getPost = function( id ) {

        // Return a clone because we don't intend to change this data globally.
        var post = _.clone( find( posts ).thatHas( 'url', id ) );
        post.contentPath = app.pathTo.post( id );
        return post;

      }

      // Configure routes based on our JSON data.
      app.config( function( $routeProvider ) {

        /**
         * Add a route.
         *
         * @param {String} route The route URL.
         * @param {String} page The route name, i.e. the text for the link to this page.
         * @param {Boolean} isDefault Whether this is the index page or not.
         */
        var addRoute = function( route, pageName ) {

          // Set up our Angular routes.
          // The templateURL is synthesized based on our site structure.
          $routeProvider.when( route, {
            templateUrl: app.pathTo.page( pageName ),
            controller: pageName
          } );
          
          // Return a representative object that's really
          // just a bunch of convenience methods.
          var methods = {};
          
          // Set this route as the default route.
          methods.setDefault = function( isDefault ) {
            
            if ( isDefault ) {
              $routeProvider.otherwise( {
                redirectTo: route
              } );
            } else {
              // TODO: Add a way to unset default.
            }
            // Allow chaining.
            return methods;
          }

          return methods;
        }

        // Add routes to the pages in our site.
        _.each( pagesData, function( route ) {
          // Set the first page to be the default.
          var isDefault = ( pages.length == 0 );
          addRoute( route.url, route.name ).setDefault( isDefault );
          pages.push( route );
        
        } );

        // Add a route for posts.
        addRoute( postData.url, 'post' );

      } );

      // Add a controller for each non-Post page.
      _.each( pagesData, function( route ) {

        app.controller( route.name, function( $scope, $routeParams ) {

          // This data is available to each page.
          $scope.posts = posts;
          $scope.pages = pages;
          $scope.work = work;

          console.log($scope.work)

          pageIsLoaded();
        
        } );

      } );

      // Add a controller for a Post.
      app.controller( 'post', function( $scope, $routeParams ) {
        
        // This data is available to each post.
        $scope.posts = posts;
        $scope.pages = pages;
        $scope.work = work;
        $scope.post = getPost( $routeParams.id );

        pageIsLoaded();

      } );

      // Let Angular compile the document.
      app.start = function() {
        angular.bootstrap( document, [ siteName ]);
      }

      if ( is( app.onReadyCallback ) ) {
        app.onReadyCallback( app );
      }

    }

    //-------------------------------------------------------------//
    //--------------------- UTILITY METHODS -----------------------//
    //-------------------------------------------------------------//

    /**
     * Check if a variable is undefined.
     *
     * @param variable {*} The variable to check.
     */
    function no( variable ) {
      return ( typeof variable === 'undefined' );
    }

    /**
     * Check if a variable is defined.
     *
     * @param variable {*} The variable to check.
     */
    function is( variable ) {
      return ( !no( variable ) );
    }

    /**
     * Search an array of objects with various techniques.
     *
     * @param objects {Array} The array of objects to search.
     */
    function find( objects ) {

      var findObject = {};

      /**
       * Search an array of objects for an object with
       * a specific property value.
       *
       * @param prop {String} The name of the property to test.
       * @param value {*} The value we're looking for.
       */
      findObject.thatHas = function( prop, value ) {

        var result = _.find( objects, function( item ) {
          return item[ prop ] == value;
        } );

        if ( no( result ) ) return '';

        return result;
      }

      return findObject;
    }

    /**
     * Call an array of functions.
     */
    function callFunctions( arr ) {
      _.each( arr, function( fn ) {
        fn();
      } );
    }

    /**
     * Perform callbacks when page is loaded.
     * Perform one-time callbacks for when site is loaded.
     */
    function pageIsLoaded() {
      callFunctions( pageLoadCallbacks );
      if ( !isSiteLoaded ) {
        callFunctions( siteLoadCallbacks );
        isSiteLoaded = true;
      }
    }

    /**
     * Store a callback for when a page is loaded.
     */
    function onPageLoad( callback ) {
      pageLoadCallbacks.push( callback );
    }

    /**
     * Store a callback for when the site is loaded.
     */
    function onSiteLoad( callback ) {
      siteLoadCallbacks.push( callback );
    }

    function fadeInSite() {

      var $viewport = $( '#viewport' );
      $viewport.hide();

      setTimeout( function() {
        $viewport.fadeIn( 200 );
      }, 50 );

      if ( !siteLoaded ) {

        setTimeout( function() {
          $( '#header' ).fadeIn( 200 );
        }, 50 );
        siteLoaded = true;

      }
    }

    /**
     * Asynchronously load an external file via a promise.
     *
     * @param url {String} Path to the file to load.
     *
     * @returns A promise.
     */
    function ajax( url ) {

      var deferred = Q.defer();
      var ajax;

      if ( window.XMLHttpRequest ) {
        // code for IE7+, Firefox, Chrome, Opera, Safari
        ajax = new XMLHttpRequest();
      } else {
        // code for IE6, IE5
        ajax=new ActiveXObject( "Microsoft.XMLHTTP" );
      }

      ajax.onreadystatechange = function() {
        if ( ajax.readyState == 4 && ajax.status == 200 ) {
          deferred.resolve( ajax.responseText );
        }
      }

      ajax.open( "GET", url, true );
      ajax.send();

      // Return a promise.
      return deferred.promise;
    }

    //-------------------------------------------------------------//
    //--------------------------- INIT ----------------------------//
    //-------------------------------------------------------------//

    // Build our angular app.
    app = angular.module( siteName, [] );
    // TO-DO: Throw errors if we are overwriting any Angular methods or properties.
    // Incorporate this into tests?

    if ( is( jsonUrl ) ) {
      load();
    }

    //-------------------------------------------------------------//
    //--------------------------- API -----------------------------//
    //-------------------------------------------------------------//

    app.onPageLoad = onPageLoad;
    app.onSiteLoad = onSiteLoad;
    // Set up our onReady handler.
    app.onReady = function( callback ) {
      app.onReadyCallback = callback;
    }

    return app;

  }

  return Acute;
  
} )( window, document );