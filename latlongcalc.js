/*!
 * JavaScript function to calculate the destination point given start point latitude / longitude (numeric degrees), bearing (numeric degrees) and distance (in m).
 */
function toRad(n) {
 return n * Math.PI / 180;
};
function toDeg(n) {
 return n * 180 / Math.PI;
};
function dest(lat, lon, course, distance) {
    var startLatitudeRadians = toRad(lat);
    var startLongitudeRadians = toRad(lon);
    var courseRadians = toRad(course);
    var distMovedRadians = distance / 6371000.0;
        
    var cosphi1 = Math.cos(startLatitudeRadians);
    var sinphi1 = Math.sin(startLatitudeRadians);
    var cosAz = Math.cos(courseRadians);
    var sinAz = Math.sin(courseRadians);
    var sinc = Math.sin(distMovedRadians);
    var cosc = Math.cos(distMovedRadians);
        
    var endLatitudeRadians = Math.asin(sinphi1 * cosc + cosphi1 * sinc * cosAz);
    var endLongitudeRadians = Math.atan2(sinc * sinAz, cosphi1 * cosc - sinphi1 * sinc * cosAz) + startLongitudeRadians;
        
    var endLatitudeDegrees = toDeg(endLatitudeRadians);
    var endLongitudeDegrees = toDeg(endLongitudeRadians);
        
    return [endLatitudeDegrees, endLongitudeDegrees];
};