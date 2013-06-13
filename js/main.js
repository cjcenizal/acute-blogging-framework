
/*

var blog = Acute.makeBlog( {
  name : 'blogsite',
  data: 'site.json',
  components : {
    'sidebar',
    'postsList'
  }
} );

blog.onReady( function() {
  console.log( 'blog loaded' )
  blog.start();
} );

*/

var blog = Acute( {
  name : 'blogsite',
  data: 'site.json'
} );

blog.onReady( function() {

  // List of posts component.
  blog.directive( 'postsList', function() {

    return {

      restrict: 'E',
      replace: true,
      templateUrl: 'html/components/posts-list.html',
      scope: { list: '=' }

    }

  } );

  // Sidebar component.
  blog.directive( 'sidebar', function() {

    return {

      restrict: 'E',
      replace: true,
      templateUrl: 'html/components/sidebar.html',
      scope: { list: '=' }

    }

  } );

  // Load post content.
  blog.directive( 'post', function( $http, $templateCache, $compile ) {

    return {

      restrict: 'E',
      terminal: true,
      compile: function( element, attr ) {

        // Get the 'path' attribute of the DOM element.
        var srcExp = attr[ 'path' ];

        return function( scope, element ) {

          var changeCounter = 0,
              childScope;

          // Erase the content of the DOM element.
          var clearContent = function() {

            if ( childScope ) {

              childScope.$destroy();
              childScope = null;

            }

            element.html('');

          };

          scope.$watch( srcExp, function ngIncludeWatchAction( src ) {

            var thisChangeId = ++changeCounter;

            if ( src ) {

              // Load the external content.
              $http.get( src, { cache: $templateCache } ).success( function( response ) {

                if (thisChangeId !== changeCounter) return;

                if (childScope) childScope.$destroy();
                childScope = scope.$new();

                element.html(response);
                $compile(element.contents())(childScope);

                childScope.$emit('$includeContentLoaded');

              } ).error( function() {

                if (thisChangeId === changeCounter) clearContent();

              });

            } else {
              clearContent();
            }

          });

        };

      }

    };

  } );

  blog.start();
} );

/*

var blog = Acute.makeBlog( {
  name : 'blogsite',
  data: 'site.json',
  components : {
    'sidebar',
    'postsList'
  }
} );

blog.onReady( function() {
  console.log( 'blog loaded' )
} );

*/