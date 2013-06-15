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

  var DATA_ID = 'data';

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
      buckets,
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

      app.data = {};

      // TO-DO: Throw errors if any data has been left unspecified.
      buckets = JSON.parse( siteJson );

      // Give index and path to its template.
      _.each( buckets, function( bucket, key ) {

        // We will need to acccess a bucket's key independently.
        bucket[ 'id' ] = key;

        // Store each bucket's items array as a property of the app,
        // to expose it for external use.
        app.data[ bucket[ 'id' ] ] = bucket[ 'items' ];

        _.each( bucket[ 'items' ], function( item, index ) {

          if ( no( item[ 'index' ] ) ) {
            
            // Assign it its index.
            item.index = bucket[ 'items' ].length - index;
            
            // Give it a valid URL.
            swapUrlAndId( bucket, item );

            // If this bucket has a template, each item will need its own content template.
            if ( is( bucket[ 'template' ] ) ) {
              item.contentPath = 'html/' + bucket[ 'id' ] + '/' + item[ 'id' ] + '.html';
            }

          }
        } );

      } );

      // Add routes based on our JSON data.
      app.config( function( $routeProvider ) {

        var isDefault,
          url,
          templatePath, 
          controllerId;

        // Add routes;
        _.each( buckets, function( bucket ) {
          
          if ( !isData( bucket ) ) {

            if ( is( bucket[ 'template' ] ) ) {

              // If the bucket has a url, then it only needs one route.
              isDefault = false;
              controllerId = bucket[ 'template' ];
              url = '/' + controllerId + '/:url';
              templatePath = 'html/' + bucket[ 'id' ] + '/' + controllerId + '.html';
              addRoute( url, templatePath, controllerId ).setDefault( isDefault );

            } else {

              // Otherwise, it needs a route per item.
              _.each( bucket.items, function( item ) {

                isDefault = ( parseInt( item[ 'default' ] ) == 1 );
                controllerId = item[ 'id' ];
                url = '/' + item[ 'id' ];
                templatePath = 'html/' + bucket[ 'id' ] + '/' + controllerId + '.html';
                addRoute( url, templatePath, controllerId ).setDefault( isDefault );

              } );
              
            }

          }

        } );

        /**
         * Add a route.
         *
         * @param {String} route The route URL.
         * @param {String} page The route name, i.e. the text for the link to this page.
         * @param {Boolean} isDefault Whether this is the index page or not.
         */
        function addRoute( url, templatePath, controllerId ) {

          // Set up our Angular routes.
          // The templateURL is synthesized based on our site structure.
          $routeProvider.when( url, {
            templateUrl: templatePath,
            controller: controllerId
          } );
          
          // Return a representative object that's really
          // just a bunch of convenience methods.
          var methods = {};
          
          // Set this route as the default route.
          methods.setDefault = function( isDefault ) {
            if ( isDefault ) {
              $routeProvider.otherwise( {
                redirectTo: url
              } );
            }
            // Allow chaining.
            return methods;
          }

          return methods;
        }

      } );

      // Add controllers.
      _.each( buckets, function( bucket ) {

        if ( !isData( bucket ) ) {

          if ( is( bucket[ 'template' ] ) ) {

            // If the bucket has a template, then it only needs one controller.
            app.controller( bucket[ 'template' ], function( $scope, $routeParams ) {

              giveScopeData( $scope );
              // Cache the item under this bucket.
              $scope.item = getItem( bucket, $routeParams[ 'url' ] );
              pageIsLoaded();

            } );

          } else {

            // Otherwise, it needs a controller per item.
            _.each( bucket[ 'items' ], function( item ) {

              app.controller( item[ 'id' ], function( $scope ) {

                giveScopeData( $scope );
                pageIsLoaded();

              } );

            } );
          }
        }
      } );

      // Create global scope.
      app.controller( 'SiteController', function( $scope ) {

        giveScopeData( $scope );

      } );

      /*
       * Copy all buckets so they can be referenced semantically.
       */
      function giveScopeData( scope ) {

        _.each( buckets, function( bucket ) {

          var obj = {};
          
          if ( isData( bucket ) ) {

            // Assign properties.
            obj = _.omit( bucket, 'id' );

          } else {

            // Assign items.
            _.each( bucket[ 'items' ], function( item ) {
              obj[ item[ 'id' ] ] = item;
            } );
            obj[ 'list' ] = bucket[ 'items' ];

          }

          scope[ bucket[ 'id' ] ] = obj;
        } );
        console.log(scope)
      }

      /**
       * We need to expose the URL as the actual URL, not the one
       * in the JSON file. SO we store the JSON url as an ID property,
       * and assign a new Angularized URL.
       */
      function swapUrlAndId( bucket, item ) {
        var url = angularizeUrl( bucket, item );
        item.id = item.url;
        item.url = url;
      }

      /**
       * Convert an item's URL into a full URL based on
       * its template's URL (if any), and prepending the #.
       *
       * @param {Object} bucket The item's bucket.
       * @param {Object} item The item.
       */
      function angularizeUrl( bucket, item ) {

        if ( is( bucket[ 'template' ] ) ) {
          // If the bucket has a template, the URL includes the bucket and item url.
          return  makeUrl( [ '/#', bucket[ 'template' ], item[ 'url' ] ] );
        } else {
          // If not, then it only includes the item url.
          return makeUrl( [ '/#', item[ 'url' ] ] );
        }

      }

      /**
       * Turn an array of strings into a URL by joining them on slashes.
       *
       * @param {Array} parts An array of strings.
       */
      function makeUrl( parts ) {
        return parts.join( '/' );
      }

      /**
       * Get a given bucket item that has a specific URL.
       */
      function getItem( bucket, url ) {
        // Return a clone because we don't intend to change this data globally.
        return _.clone( find( bucket[ 'items' ] ).thatHas( 'id', url ) );
      }

      /**
       * Determine if this bucket needs a route + controller.
       */
      function isData( bucket ) {
        return bucket[ 'id' ] == DATA_ID;
      }

      // Let Angular compile the document.
      app.start = function() {
        console.log('start', buckets)
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
    // TO-DO: Throw errors if we are overwriting any Angular methods or properties.
    // Incorporate this into tests?
    app = angular.module( siteName, [] );

    // Load site data.
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