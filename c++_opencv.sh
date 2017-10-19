version=$(/usr/local/bin/opencv_version)
if [ $version = "2.4.13.2" ]; then
	echo "-l opencv_calib3d -l opencv_contrib -l opencv_core -l opencv_features2d -l opencv_flann -l opencv_gpu -l opencv_highgui -l opencv_imgproc -l opencv_legacy -l opencv_ml -l opencv_nonfree -l opencv_objdetect -l opencv_ocl -l opencv_photo -l opencv_stitching -l opencv_superres -l opencv_video -l opencv_videostab"
elif [ $version = "3.3.0" ]; then
	echo "-l opencv_calib3d -l opencv_core -l opencv_features2d -l opencv_flann -l opencv_highgui -l opencv_imgproc -l opencv_ml -l opencv_objdetect -l opencv_photo -l opencv_stitching -l opencv_superres -l opencv_video -l opencv_videostab -l opencv_imgcodecs"
fi
